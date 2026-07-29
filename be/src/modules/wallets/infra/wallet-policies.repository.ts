// Repository wallet_policies — mọi chuyển trạng thái active/pending đi qua
// TRANSACTION có điều kiện WHERE status (chống race giữa PUT / DELETE / cron
// cùng lúc): 0 row = thua race, caller nhận null và trả 409.
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classifyChange,
  DEFAULT_DAILY_STROOPS,
  DEFAULT_PER_TX_STROOPS,
  type PolicyLimits,
  RAISE_DELAY_SECONDS,
} from "../domain/spending-policy";
import { type WalletPolicy, walletPolicies } from "./wallet-policies.schema";

/** Bản active của ví — null nếu ví chưa từng materialize (dùng default). */
export async function activePolicy(walletId: string): Promise<WalletPolicy | null> {
  const [row] = await db
    .select()
    .from(walletPolicies)
    .where(and(eq(walletPolicies.walletId, walletId), eq(walletPolicies.status, "active")))
    .limit(1);
  return row ?? null;
}

export async function pendingPolicy(walletId: string): Promise<WalletPolicy | null> {
  const [row] = await db
    .select()
    .from(walletPolicies)
    .where(and(eq(walletPolicies.walletId, walletId), eq(walletPolicies.status, "pending")))
    .limit(1);
  return row ?? null;
}

/** Ngưỡng ĐANG hiệu lực cho policy engine — ví chưa có bản ghi = default
 * (1.000/10.000 XLM). Fallback trong code thay vì backfill: ví cũ tự nhiên
 * có mặc định, không cần migration data. */
export async function effectiveLimits(walletId: string): Promise<PolicyLimits> {
  const row = await activePolicy(walletId);
  if (!row) return { perTxLimit: DEFAULT_PER_TX_STROOPS, dailyLimit: DEFAULT_DAILY_STROOPS };
  return { perTxLimit: row.perTxLimit, dailyLimit: row.dailyLimit };
}

/** Materialize bản active mặc định cho ví chưa có (idempotent — đụng unique
 * active thì đọc lại bản có sẵn). Gọi lúc tạo ví (A2) và trước PUT. */
export async function ensureActivePolicy(walletId: string, userId: string): Promise<WalletPolicy> {
  const existing = await activePolicy(walletId);
  if (existing) return existing;
  try {
    const [row] = await db
      .insert(walletPolicies)
      .values({
        walletId,
        perTxLimit: DEFAULT_PER_TX_STROOPS,
        dailyLimit: DEFAULT_DAILY_STROOPS,
        version: 1,
        status: "active",
        effectiveAt: new Date(),
        createdBy: userId,
      })
      .returning();
    if (!row) throw new Error("POLICY_INSERT_FAILED");
    return row;
  } catch (err) {
    // Race hai request đầu tiên: unique (wallet, active) — bản kia thắng, dùng nó.
    const raced = await activePolicy(walletId);
    if (raced) return raced;
    throw err;
  }
}

export type ProposeResult =
  | { kind: "applied"; policy: WalletPolicy }
  | { kind: "pending"; policy: WalletPolicy };

/**
 * Đề nghị đổi ngưỡng (B1/B2): hạ → active MỚI ngay (bản cũ superseded); nâng →
 * bản pending effective_at = now + 24h (đè pending cũ nếu có — đề nghị mới
 * thay đề nghị cũ, đồng hồ chạy lại). Trong lúc chờ bản active KHÔNG đổi (B3).
 */
export async function proposeChange(input: {
  walletId: string;
  userId: string;
  next: PolicyLimits;
  current: WalletPolicy;
}): Promise<ProposeResult> {
  const change = classifyChange(
    { perTxLimit: input.current.perTxLimit, dailyLimit: input.current.dailyLimit },
    input.next,
  );
  const now = new Date();
  return db.transaction(async (tx) => {
    // Pending cũ (nếu có) → superseded, bất kể nâng hay hạ: hạ áp ngay thì đề
    // nghị nâng đang treo không còn nghĩa; nâng mới thì thay đề nghị cũ.
    await tx
      .update(walletPolicies)
      .set({ status: "superseded" })
      .where(
        and(eq(walletPolicies.walletId, input.walletId), eq(walletPolicies.status, "pending")),
      );

    // Version = max+1 trên MỌI bản (kể cả cancelled/superseded) — unique
    // (wallet, version) tính cả bản chết, +1 từ active là đụng bản pending cũ.
    const [maxRow] = await tx
      .select({ max: sql<number>`coalesce(max(${walletPolicies.version}), 0)` })
      .from(walletPolicies)
      .where(eq(walletPolicies.walletId, input.walletId));
    const version = Number(maxRow?.max ?? input.current.version) + 1;
    if (change === "lower") {
      const [updated] = await tx
        .update(walletPolicies)
        .set({ status: "superseded" })
        .where(and(eq(walletPolicies.id, input.current.id), eq(walletPolicies.status, "active")))
        .returning({ id: walletPolicies.id });
      if (!updated) throw new Error("POLICY_CONFLICT"); // thua race — handler trả 409
      const [row] = await tx
        .insert(walletPolicies)
        .values({
          walletId: input.walletId,
          perTxLimit: input.next.perTxLimit,
          dailyLimit: input.next.dailyLimit,
          version,
          status: "active",
          effectiveAt: now,
          createdBy: input.userId,
        })
        .returning();
      if (!row) throw new Error("POLICY_INSERT_FAILED");
      return { kind: "applied", policy: row };
    }
    const [row] = await tx
      .insert(walletPolicies)
      .values({
        walletId: input.walletId,
        perTxLimit: input.next.perTxLimit,
        dailyLimit: input.next.dailyLimit,
        version,
        status: "pending",
        effectiveAt: new Date(now.getTime() + RAISE_DELAY_SECONDS * 1000),
        createdBy: input.userId,
      })
      .returning();
    if (!row) throw new Error("POLICY_INSERT_FAILED");
    return { kind: "pending", policy: row };
  });
}

/** Huỷ đề nghị nâng (B5) — điều kiện status='pending'; huỷ xong bản cũ giữ nguyên. */
export async function cancelPending(walletId: string): Promise<WalletPolicy | null> {
  const [row] = await db
    .update(walletPolicies)
    .set({ status: "cancelled" })
    .where(and(eq(walletPolicies.walletId, walletId), eq(walletPolicies.status, "pending")))
    .returning();
  return row ?? null;
}

/**
 * Cron áp đề nghị hết hạn chờ (B6): pending có effective_at ≤ now → active
 * (bản active cũ superseded). Mỗi ví một transaction — ví lỗi không kéo cả lượt.
 */
export async function applyDuePending(now: Date): Promise<WalletPolicy[]> {
  const due = await db
    .select()
    .from(walletPolicies)
    .where(and(eq(walletPolicies.status, "pending"), lte(walletPolicies.effectiveAt, now)));
  const applied: WalletPolicy[] = [];
  for (const row of due) {
    const ok = await db
      .transaction(async (tx) => {
        // Hạ bản active cũ TRƯỚC rồi mới flip pending→active — thứ tự ngược lại
        // đụng unique (wallet, active). Flip tại chỗ (không insert bản mới) để
        // giữ nguyên version + không đụng unique (wallet, version).
        await tx
          .update(walletPolicies)
          .set({ status: "superseded" })
          .where(
            and(eq(walletPolicies.walletId, row.walletId), eq(walletPolicies.status, "active")),
          );
        const [flipped] = await tx
          .update(walletPolicies)
          .set({ status: "active", effectiveAt: now })
          .where(and(eq(walletPolicies.id, row.id), eq(walletPolicies.status, "pending")))
          .returning({ id: walletPolicies.id });
        if (!flipped) throw new Error("POLICY_PENDING_GONE"); // huỷ giữa chừng → rollback cả tx
        return true;
      })
      .catch(() => false);
    if (ok) applied.push(row);
  }
  return applied;
}
