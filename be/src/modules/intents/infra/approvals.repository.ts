// Query quanh PHIẾU DUYỆT guardian (LÔ 1 A5/A6) — tách khỏi intents.repository
// để giữ trần 300 dòng/file. Cùng module intents nên import schema nội bộ được.
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { guardians } from "../../guardians/infra/guardians.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { approvalRequests } from "./approvals.schema";
import { transactionIntents } from "./intents.schema";

/** userId (Better Auth) của các guardian hiệu lực — đích gửi thông báo
 * "cần bạn xác nhận". Guardian chưa gắn user (userId NULL) không nhận được. */
export async function guardianUserIdsForWallet(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: guardians.userId })
    .from(guardians)
    .where(and(eq(guardians.walletId, walletId), sql`${guardians.status} != 'removed'`));
  return [...new Set(rows.map((r) => r.userId).filter((u): u is string => Boolean(u)))];
}

/** Địa chỉ on-chain của guardian hiệu lực — guardian của ví LUÔN là người quen
 * (C2 lô policy): gửi cho chính người trông ví không thể là "địa chỉ lạ". */
export async function guardianOnchainKeysForWallet(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ key: guardians.onchainKey })
    .from(guardians)
    .where(and(eq(guardians.walletId, walletId), sql`${guardians.status} != 'removed'`));
  return [...new Set(rows.map((r) => r.key).filter((k): k is string => Boolean(k)))];
}

/** Đúng MỘT cột user.name của chủ ví (khuôn findOwnerName bên guardians) —
 * cho payload thông báo. Không email, không địa chỉ. */
export async function ownerNameForWallet(walletId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: user.name })
    .from(wallets)
    .innerJoin(user, eq(wallets.userId, user.id))
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row?.name ?? null;
}

/** userId chủ ví — đích thông báo approve/reject. */
export async function ownerUserIdForWallet(walletId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row?.userId ?? null;
}

/**
 * Huỷ lệnh CÓ ĐIỀU KIỆN — chỉ khi status còn đúng bản vừa đọc (chống race với
 * guardian đang duyệt song song; KHÔNG bao giờ đè settled/submitting). 0 row = thua race.
 */
export async function cancelIntentIfStatus(id: string, fromStatus: string): Promise<boolean> {
  const rows = await db
    .update(transactionIntents)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(transactionIntents.id, id), eq(transactionIntents.status, fromStatus)))
    .returning({ id: transactionIntents.id });
  return rows.length === 1;
}

/** Huỷ lệnh (owner cancel): phiếu pending của intent → expired, phiếu đã quyết giữ nguyên. */
export async function expirePendingApprovals(intentId: string): Promise<void> {
  await db
    .update(approvalRequests)
    .set({ decision: "expired" })
    .where(and(eq(approvalRequests.intentId, intentId), eq(approvalRequests.decision, "pending")));
}

export type PendingApprovalRow = {
  approvalId: string;
  intentId: string;
  walletId: string;
  ownerName: string | null;
  amount: bigint | null;
  recipient: string | null;
  reasons: unknown;
  expiresAt: Date;
};

/**
 * Hộp phiếu chờ của guardian ĐANG ĐĂNG NHẬP (A5 lỗ thứ ba — trước đây guardian
 * không có cách nào khám phá lệnh chờ mình). Chỉ phiếu pending còn hạn của
 * intent còn đứng ở awaiting_guardian. KHÔNG select challenge_hash — nó là
 * vật liệu binding server-side, không có việc gì ở client.
 */
export async function pendingApprovalsForGuardianUser(
  userId: string,
  now: Date,
): Promise<PendingApprovalRow[]> {
  return (
    db
      .select({
        approvalId: approvalRequests.id,
        intentId: approvalRequests.intentId,
        walletId: transactionIntents.walletId,
        ownerName: user.name,
        amount: transactionIntents.amount,
        recipient: transactionIntents.recipient,
        reasons: transactionIntents.policyReasons,
        expiresAt: approvalRequests.expiresAt,
      })
      .from(approvalRequests)
      .innerJoin(guardians, eq(approvalRequests.guardianId, guardians.id))
      .innerJoin(transactionIntents, eq(approvalRequests.intentId, transactionIntents.id))
      .innerJoin(wallets, eq(transactionIntents.walletId, wallets.id))
      // leftJoin: chủ ví chưa có dòng user (soft-ref) thì phiếu VẪN phải hiện —
      // thiếu tên không phải lý do giấu lệnh đang chờ duyệt.
      .leftJoin(user, eq(wallets.userId, user.id))
      .where(
        and(
          eq(guardians.userId, userId),
          eq(approvalRequests.decision, "pending"),
          gte(approvalRequests.expiresAt, now),
          eq(transactionIntents.status, "awaiting_guardian"),
        ),
      )
      .orderBy(desc(approvalRequests.createdAt))
  );
}
