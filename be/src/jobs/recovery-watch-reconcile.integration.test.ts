// Lô R7 — cổng nghiệm thu việc DỌN mirror, đo trên Postgres THẬT.
//
// Luật quyết định (ba điều kiện + fail-safe) đã khoá ở `stale-mirror.test.ts`
// mức thuần. File này khoá phần THI HÀNH, ba chuyện mà chỉ DB thật mới chứng
// minh được:
//   1. dòng `pending`/`ready` chuyển đúng sang `'expired'`;
//   2. dòng `executed`/`vetoed` KHÔNG bị đụng — nhật ký khôi phục không được
//      viết đè chuyện đã rồi (cùng bài học với R6 nhánh `recovery.vetoed`);
//   3. có `audit_log` để tra ngược, và KHÔNG có email nào được xếp hàng.
import { afterAll, describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "@/modules/guardians/infra/guardians.schema";
import { auditLog } from "@/modules/indexer/infra/audit-log.schema";
import { notifications } from "@/modules/notifications/infra/notifications.schema";
import { recoveryRequests } from "@/modules/recovery/infra/recovery-requests.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { expireStaleMirrorRows } from "./recovery-watch-reconcile";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const cleanupWalletIds: string[] = [];
const cleanupUserIds: string[] = [];

function randomAddress(prefix: "C" | "G" = "C"): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "A")}`;
}

async function seedWallet() {
  const ownerUserId = `it-r7-owner-${crypto.randomUUID().slice(0, 8)}`;
  cleanupUserIds.push(ownerUserId);
  const [w] = await db
    .insert(wallets)
    .values({
      userId: ownerUserId,
      stellarAddress: randomAddress("G"),
      threshold: 2,
      timelockSecs: 86_400,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  return { walletId: w.id, ownerUserId };
}

async function seedRequest(walletId: string, status: string) {
  const [row] = await db
    .insert(recoveryRequests)
    .values({
      walletId,
      newOwner: "ff".repeat(28),
      status,
      approvals: 1,
      threshold: 2,
    })
    .returning({ id: recoveryRequests.id });
  if (!row) throw new Error("request insert failed");
  return row.id;
}

async function statusOf(id: string): Promise<string> {
  const [row] = await db
    .select({ status: recoveryRequests.status })
    .from(recoveryRequests)
    .where(eq(recoveryRequests.id, id));
  return row?.status ?? "GONE";
}

afterAll(async () => {
  if (!dbUp) return;
  if (cleanupWalletIds.length > 0) {
    await db.delete(recoveryRequests).where(inArray(recoveryRequests.walletId, cleanupWalletIds));
    await db.delete(guardians).where(inArray(guardians.walletId, cleanupWalletIds));
    // `audit_log` KHÔNG dọn được: trigger append-only (migration 0008) chối DELETE.
    // Đó là hành vi đúng — nhật ký kiểm tra mà xoá được thì nó không còn là nhật ký.
    await db.delete(wallets).where(inArray(wallets.id, cleanupWalletIds));
  }
  if (cleanupUserIds.length > 0) {
    await db.delete(notifications).where(inArray(notifications.userId, cleanupUserIds));
  }
});

describe("R7 — dọn dòng mirror chết", () => {
  testIt("pending và ready đều chuyển sang 'expired'", async () => {
    const { walletId, ownerUserId } = await seedWallet();
    const pending = await seedRequest(walletId, "pending");
    const ready = await seedRequest(walletId, "ready");

    const cleaned = await expireStaleMirrorRows({
      walletId,
      ownerUserId,
      reason: "chain:no-request",
    });

    expect(cleaned).toBe(2);
    expect(await statusOf(pending)).toBe("expired");
    expect(await statusOf(ready)).toBe("expired");
  });

  testIt("🔴 executed và vetoed KHÔNG bị đụng — không viết đè chuyện đã rồi", async () => {
    const { walletId, ownerUserId } = await seedWallet();
    const executed = await seedRequest(walletId, "executed");
    const vetoed = await seedRequest(walletId, "vetoed");
    const alreadyExpired = await seedRequest(walletId, "expired");

    const cleaned = await expireStaleMirrorRows({
      walletId,
      ownerUserId,
      reason: "chain:no-request",
    });

    // Không có dòng nào ĐANG SỐNG → không có gì để dọn.
    expect(cleaned).toBe(0);
    expect(await statusOf(executed)).toBe("executed");
    expect(await statusOf(vetoed)).toBe("vetoed");
    expect(await statusOf(alreadyExpired)).toBe("expired");
  });

  testIt("dọn xong có audit_log ghi rõ vì sao dòng biến mất", async () => {
    const { walletId, ownerUserId } = await seedWallet();
    const id = await seedRequest(walletId, "pending");

    await expireStaleMirrorRows({ walletId, ownerUserId, reason: "chain:finalized" });

    const rows = await db
      .select({ kind: auditLog.kind, payload: auditLog.payload, actorType: auditLog.actorType })
      .from(auditLog)
      .where(and(eq(auditLog.walletId, walletId), eq(auditLog.kind, "recovery.expired")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorType).toBe("system");
    const payload = rows[0]?.payload as { reason?: string; requestIds?: string[] };
    expect(payload.reason).toBe("chain:finalized");
    expect(payload.requestIds).toEqual([id]);
  });

  testIt("🔴 KHÔNG gửi email/thông báo nào khi dọn — đây là dọn dẹp im lặng", async () => {
    const { walletId, ownerUserId } = await seedWallet();
    // Guardian có tài khoản: nếu code lỡ enqueue thư cho guardian thì lộ ra ở đây.
    const guardianUserId = `it-r7-g-${crypto.randomUUID().slice(0, 8)}`;
    cleanupUserIds.push(guardianUserId);
    await db.insert(guardians).values({ walletId, userId: guardianUserId, status: "active" });
    await seedRequest(walletId, "pending");

    await expireStaleMirrorRows({ walletId, ownerUserId, reason: "chain:no-request" });

    const queued = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(inArray(notifications.userId, [ownerUserId, guardianUserId]));
    expect(queued).toHaveLength(0);
  });

  testIt("không có dòng sống → không ghi audit, không làm gì", async () => {
    const { walletId, ownerUserId } = await seedWallet();

    const cleaned = await expireStaleMirrorRows({
      walletId,
      ownerUserId,
      reason: "chain:no-request",
    });

    expect(cleaned).toBe(0);
    const rows = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.walletId, walletId));
    expect(rows).toHaveLength(0);
  });
});
