// Integration Postgres THẬT — vòng đời wallet_policies (B1/B2/B3/B5/B6):
// hạ áp ngay · nâng treo pending 24h (active GIỮ NGUYÊN) · huỷ pending ·
// cron áp pending đến hạn · version không đụng unique.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { DEFAULT_DAILY_STROOPS, DEFAULT_PER_TX_STROOPS } from "../domain/spending-policy";
import {
  activePolicy,
  applyDuePending,
  cancelPending,
  effectiveLimits,
  ensureActivePolicy,
  pendingPolicy,
  proposeChange,
} from "./wallet-policies.repository";
import { walletPolicies } from "./wallet-policies.schema";
import { wallets } from "./wallets.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const OWNER = `it-policy-owner-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

async function seedWallet(): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: OWNER,
      stellarAddress: `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 40)}TEST`,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  return w.id;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) await db.delete(wallets).where(eq(wallets.id, id));
});

describe("wallet_policies — vòng đời đổi ngưỡng", () => {
  testIt("ví chưa có bản ghi → effectiveLimits trả DEFAULT; ensure materialize v1", async () => {
    const walletId = await seedWallet();
    const limits = await effectiveLimits(walletId);
    expect(limits.perTxLimit).toBe(DEFAULT_PER_TX_STROOPS);
    expect(limits.dailyLimit).toBe(DEFAULT_DAILY_STROOPS);

    const active = await ensureActivePolicy(walletId, OWNER);
    expect(active.version).toBe(1);
    expect(active.status).toBe("active");
    // Idempotent — gọi lại trả đúng bản cũ.
    const again = await ensureActivePolicy(walletId, OWNER);
    expect(again.id).toBe(active.id);
  });

  testIt("B1: HẠ → active mới NGAY, bản cũ superseded", async () => {
    const walletId = await seedWallet();
    const current = await ensureActivePolicy(walletId, OWNER);
    const result = await proposeChange({
      walletId,
      userId: OWNER,
      current,
      next: { perTxLimit: 5_000_000_000n, dailyLimit: 50_000_000_000n },
    });
    expect(result.kind).toBe("applied");
    const limits = await effectiveLimits(walletId);
    expect(limits.perTxLimit).toBe(5_000_000_000n);
    expect(await pendingPolicy(walletId)).toBeNull();
  });

  testIt("B2+B3: NÂNG → pending +24h, active GIỮ NGUYÊN suốt cửa sổ chờ", async () => {
    const walletId = await seedWallet();
    const current = await ensureActivePolicy(walletId, OWNER);
    const before = Date.now();
    const result = await proposeChange({
      walletId,
      userId: OWNER,
      current,
      next: { perTxLimit: 50_000_000_000n, dailyLimit: 150_000_000_000n },
    });
    expect(result.kind).toBe("pending");
    // effective_at ≈ now + 24h (dung sai 60s cho máy chậm).
    const eta = result.policy.effectiveAt.getTime();
    expect(Math.abs(eta - (before + 86_400_000))).toBeLessThan(60_000);
    // B3 — ngưỡng ĐANG hiệu lực không đổi.
    const limits = await effectiveLimits(walletId);
    expect(limits.perTxLimit).toBe(DEFAULT_PER_TX_STROOPS);

    // ⚠️ giảm per_tx + tăng daily → vẫn là NÂNG (pending mới thay pending cũ).
    const result2 = await proposeChange({
      walletId,
      userId: OWNER,
      current: (await activePolicy(walletId)) ?? current,
      next: { perTxLimit: 1_000_000_000n, dailyLimit: 199_000_000_000n },
    });
    expect(result2.kind).toBe("pending");
    const pendings = await db
      .select()
      .from(walletPolicies)
      .where(eq(walletPolicies.walletId, walletId));
    expect(pendings.filter((p) => p.status === "pending").length).toBe(1); // chỉ MỘT pending
  });

  testIt("B5: huỷ pending → active giữ nguyên, pending thành cancelled", async () => {
    const walletId = await seedWallet();
    const current = await ensureActivePolicy(walletId, OWNER);
    await proposeChange({
      walletId,
      userId: OWNER,
      current,
      next: { perTxLimit: 50_000_000_000n, dailyLimit: 150_000_000_000n },
    });
    const cancelled = await cancelPending(walletId);
    expect(cancelled?.status).toBe("cancelled");
    expect(await pendingPolicy(walletId)).toBeNull();
    const limits = await effectiveLimits(walletId);
    expect(limits.perTxLimit).toBe(DEFAULT_PER_TX_STROOPS);
    // Huỷ lần hai → null (không có gì để huỷ).
    expect(await cancelPending(walletId)).toBeNull();
  });

  testIt("B6: pending ĐẾN HẠN được cron áp; CHƯA đến hạn thì không", async () => {
    const walletId = await seedWallet();
    const current = await ensureActivePolicy(walletId, OWNER);
    const { policy: pending } = (await proposeChange({
      walletId,
      userId: OWNER,
      current,
      next: { perTxLimit: 50_000_000_000n, dailyLimit: 150_000_000_000n },
    })) as { kind: "pending"; policy: { id: string; effectiveAt: Date } };

    // CHƯA đến hạn — cron chạy bây giờ không áp gì cho ví này.
    const early = await applyDuePending(new Date());
    expect(early.some((p) => p.walletId === walletId)).toBe(false);

    // Đến hạn (mô phỏng: now = effective_at + 1s) — áp, active đổi, pending hết.
    const later = new Date(pending.effectiveAt.getTime() + 1000);
    const applied = await applyDuePending(later);
    expect(applied.some((p) => p.walletId === walletId)).toBe(true);
    const limits = await effectiveLimits(walletId);
    expect(limits.perTxLimit).toBe(50_000_000_000n);
    expect(limits.dailyLimit).toBe(150_000_000_000n);
    expect(await pendingPolicy(walletId)).toBeNull();
  });
});
