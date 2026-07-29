// Repository transaction_intents (PHA 3.3) — idempotency ở TẦNG DB (A3):
// unique (wallet_id, client_intent_id); INSERT đụng 23505 → SELECT bản cũ trả về.
// Đây là chốt đúng cho 50 request song song (Redis NX chỉ là guard phụ cho
// double-tap KÝ ở PHA 5 — không thay được unique index).
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { enqueueNotificationTx } from "@/modules/notifications";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { type Wallet, wallets } from "../../wallets/infra/wallets.schema";
import { computeIntentHash } from "../domain/hashing";
import { DRAFT_TTL_SECONDS, expiresAtFrom } from "../domain/ttl";
import { type ApprovalRequest, approvalRequests } from "./approvals.schema";
import {
  type NewTransactionIntent,
  type TransactionIntent,
  transactionIntents,
} from "./intents.schema";

const PG_UNIQUE_VIOLATION = "23505";

// Drizzle bọc PostgresError — mã 23xxx nằm trong chuỗi err.cause, không phải
// top-level (cùng lý do test-support/pg.ts có helper riêng cho test).
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if ((cur as { code?: unknown }).code === PG_UNIQUE_VIOLATION) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** Ví thuộc user không (ownership — route đã requireAuth, đây là lớp 2). */
export async function walletOwnedBy(walletId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)))
    .limit(1);
  return rows.length === 1;
}

export type CreateIntentInput = {
  walletId: string;
  clientIntentId: string;
  createdBy: "owner" | "ai";
  operations: unknown;
  recipient: string | null;
  amount: bigint | null;
};

/** Insert idempotent: lần 2+ cùng (wallet, client_intent_id) trả bản ghi CŨ. */
export async function createIdempotent(
  input: CreateIntentInput,
): Promise<{ intent: TransactionIntent; deduplicated: boolean }> {
  const now = new Date();
  const values: NewTransactionIntent = {
    walletId: input.walletId,
    clientIntentId: input.clientIntentId,
    createdBy: input.createdBy,
    status: "draft",
    operations: input.operations,
    recipient: input.recipient,
    amount: input.amount,
    intentHash: computeIntentHash({
      walletId: input.walletId,
      version: 1,
      operations: input.operations,
      recipient: input.recipient,
      amount: input.amount,
    }),
    expiresAt: expiresAtFrom(now, DRAFT_TTL_SECONDS),
  };
  try {
    const [row] = await db.insert(transactionIntents).values(values).returning();
    if (!row) throw new Error("INTENT_INSERT_FAILED");
    return { intent: row, deduplicated: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [existing] = await db
      .select()
      .from(transactionIntents)
      .where(
        and(
          eq(transactionIntents.walletId, input.walletId),
          eq(transactionIntents.clientIntentId, input.clientIntentId),
        ),
      )
      .limit(1);
    if (!existing) throw err;
    return { intent: existing, deduplicated: true };
  }
}

export async function walletById(walletId: string): Promise<Wallet | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  return row ?? null;
}

export async function intentById(id: string): Promise<TransactionIntent | null> {
  const [row] = await db
    .select()
    .from(transactionIntents)
    .where(eq(transactionIntents.id, id))
    .limit(1);
  return row ?? null;
}

/** Cập nhật intent (state transition + trường policy/hash). updatedAt luôn set. */
export async function updateIntent(
  id: string,
  patch: Partial<
    Pick<
      TransactionIntent,
      "status" | "policyDecision" | "policyVersion" | "policyReasons" | "intentHash"
    >
  >,
): Promise<TransactionIntent> {
  const [row] = await db
    .update(transactionIntents)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(transactionIntents.id, id))
    .returning();
  if (!row) throw new Error("INTENT_UPDATE_FAILED");
  return row;
}

/** Người nhận ĐÃ từng gửi thành công (settled) — cho policy known_recipient. */
export async function knownRecipients(walletId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ recipient: transactionIntents.recipient })
    .from(transactionIntents)
    .where(
      and(eq(transactionIntents.walletId, walletId), eq(transactionIntents.status, "settled")),
    );
  return rows.map((r) => r.recipient).filter((r): r is string => r !== null);
}

/** Tổng đã chi trong ngày (settled, từ mốc `since`) — cho policy daily limit. */
export async function dailySpent(walletId: string, since: Date): Promise<bigint> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionIntents.amount}), 0)` })
    .from(transactionIntents)
    .where(
      and(
        eq(transactionIntents.walletId, walletId),
        eq(transactionIntents.status, "settled"),
        gte(transactionIntents.createdAt, since),
      ),
    );
  return BigInt(row?.total ?? "0");
}

/** Guardian hiệu lực (id) của ví — tạo phiếu duyệt cho intent vượt ngưỡng. */
export async function activeGuardianIds(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(and(eq(guardians.walletId, walletId), sql`${guardians.status} != 'removed'`));
  return rows.map((r) => r.id);
}

/** Tạo phiếu duyệt cho MỖI guardian, bind challenge_hash (K5). Idempotent nhờ
 * unique (intent, guardian, version): tạo lại cùng version → bỏ qua trùng. */
export async function createGuardianApprovals(input: {
  intentId: string;
  intentVersion: number;
  challengeHash: string;
  guardianIds: string[];
  expiresAt: Date;
}): Promise<void> {
  if (input.guardianIds.length === 0) return;
  await db
    .insert(approvalRequests)
    .values(
      input.guardianIds.map((guardianId) => ({
        intentId: input.intentId,
        intentVersion: input.intentVersion,
        guardianId,
        challengeHash: input.challengeHash,
        expiresAt: input.expiresAt,
      })),
    )
    .onConflictDoNothing();
}

export async function approvalForGuardianUser(
  intentId: string,
  userId: string,
): Promise<{ approval: ApprovalRequest; guardianId: string } | null> {
  const [row] = await db
    .select({ approval: approvalRequests, guardianId: guardians.id })
    .from(approvalRequests)
    .innerJoin(guardians, eq(approvalRequests.guardianId, guardians.id))
    .where(and(eq(approvalRequests.intentId, intentId), eq(guardians.userId, userId)))
    .limit(1);
  return row ? { approval: row.approval, guardianId: row.guardianId } : null;
}

export async function markApproval(
  id: string,
  decision: "approved" | "rejected",
  verifiedCall: boolean,
): Promise<void> {
  await db
    .update(approvalRequests)
    .set({ decision, verifiedCall, decidedAt: new Date() })
    .where(eq(approvalRequests.id, id));
}

export async function appendIntentAudit(entry: {
  walletId: string;
  kind: string;
  actorType: "owner" | "guardian" | "system";
  actorId?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values(entry);
}

/** Các state có đường system.expire trong bảng state machine — giữ ĐỒNG BỘ với
 * modules/intents/domain/state-machine.ts (có test khoá bên sweeper.test). */
export const SWEEPABLE_STATES = [
  "draft",
  "review",
  "awaiting_guardian",
  "approved",
  "awaiting_signature",
] as const;

/** Quét TTL (A4): mọi intent quá expires_at ở state quét được → expired.
 * Mỗi intent hết hạn ghi MỘT dòng audit (actor system) — cùng transaction.
 * LÔ 1 A6: hết hạn PHẢI báo — chủ ví ("tiền không rời ví") + guardian còn
 * phiếu pending ("không cần làm gì nữa"), email + sse, cùng transaction. */
export async function sweepExpired(now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(transactionIntents)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          inArray(transactionIntents.status, [...SWEEPABLE_STATES]),
          lt(transactionIntents.expiresAt, now),
        ),
      )
      .returning({ id: transactionIntents.id, walletId: transactionIntents.walletId });
    if (expired.length > 0) {
      await tx.insert(auditLog).values(
        expired.map((row) => ({
          walletId: row.walletId,
          kind: "intent.expired",
          actorType: "system",
          payload: { intentId: row.id },
        })),
      );
      // Đích thông báo — GOM TRƯỚC khi flip phiếu (sau flip không còn biết ai
      // đang pending). Dedupe theo user: một lượt quét nhiều intent vẫn 1 thư/người.
      const walletIds = [...new Set(expired.map((r) => r.walletId))];
      const owners = await tx
        .select({ userId: wallets.userId })
        .from(wallets)
        .where(inArray(wallets.id, walletIds));
      const pendingGuardians = await tx
        .select({ userId: guardians.userId })
        .from(approvalRequests)
        .innerJoin(guardians, eq(approvalRequests.guardianId, guardians.id))
        .where(
          and(
            inArray(
              approvalRequests.intentId,
              expired.map((r) => r.id),
            ),
            eq(approvalRequests.decision, "pending"),
          ),
        );
      const targets: { userId: string; templateKey: string }[] = [];
      for (const uid of new Set(owners.map((o) => o.userId))) {
        targets.push({ userId: uid, templateKey: "intent.expired" });
      }
      for (const uid of new Set(
        pendingGuardians.map((g) => g.userId).filter((u): u is string => Boolean(u)),
      )) {
        targets.push({ userId: uid, templateKey: "approval.expired" });
      }
      for (const t of targets) {
        for (const channel of ["email", "sse"] as const) {
          await enqueueNotificationTx(tx, {
            userId: t.userId,
            templateKey: t.templateKey,
            channel,
          });
        }
      }
    }
    // approval_requests pending quá hạn → expired (cùng lượt quét).
    await tx
      .update(approvalRequests)
      .set({ decision: "expired" })
      .where(and(eq(approvalRequests.decision, "pending"), lt(approvalRequests.expiresAt, now)));
    return expired.length;
  });
}
