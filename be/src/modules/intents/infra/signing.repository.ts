// Query CHIỀU CHỦ VÍ: lệnh của chính mình đang chờ mình ký (lô vá L2
// 2026-07-30). Tách khỏi intents.repository để giữ trần 300 dòng/file, cùng lý
// do approvals.repository đã tách.
//
// Vì sao cần: guardian duyệt xong, BE đưa intent sang `awaiting_signature` và
// dừng đúng chỗ đó — custody trên chuỗi, chữ ký passkey của chủ ví vẫn là thứ
// duy nhất chuyển được tiền. Nhưng trước lô này KHÔNG có đường nào để chủ ví
// KHÁM PHÁ lại lệnh đó: `intentId` chỉ sống trong state của tab đang mở, đóng
// tab hoặc F5 là mất, lệnh nằm im tới khi sweeper cho hết hạn sau 24h. Đây là
// đúng lỗ mà `pendingApprovalsForGuardianUser` đã vá cho chiều guardian.
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { transactionIntents } from "./intents.schema";

export type AwaitingSignatureRow = {
  intentId: string;
  walletId: string;
  /** Địa chỉ ví nguồn — FE cần để đối chiếu `from` của entry (chống ký mù). */
  walletAddress: string;
  amount: bigint | null;
  recipient: string | null;
  reasons: unknown;
  createdAt: Date;
  expiresAt: Date | null;
};

/**
 * Lệnh đang chờ CHÍNH chủ ví ký. Scope theo owner bằng JOIN `wallets` assert
 * `user_id` (khuôn chung của mọi query trong repo này) — không có đường nào
 * thấy lệnh của ví người khác.
 *
 * Lọc hạn: intent quá `expires_at` sẽ bị sweeper cho `expired`; hiện nó ra rồi
 * để người dùng bấm "Ký ngay" và ăn 409 là dắt họ vào ngõ cụt lần thứ hai.
 * `expires_at IS NULL` vẫn hiện — intent cũ trước khi có TTL không phải vì thế
 * mà biến mất khỏi tầm mắt.
 */
export async function intentsAwaitingSignatureForOwner(
  userId: string,
  now: Date,
): Promise<AwaitingSignatureRow[]> {
  return db
    .select({
      intentId: transactionIntents.id,
      walletId: transactionIntents.walletId,
      walletAddress: wallets.stellarAddress,
      amount: transactionIntents.amount,
      recipient: transactionIntents.recipient,
      reasons: transactionIntents.policyReasons,
      createdAt: transactionIntents.createdAt,
      expiresAt: transactionIntents.expiresAt,
    })
    .from(transactionIntents)
    .innerJoin(wallets, eq(transactionIntents.walletId, wallets.id))
    .where(
      and(
        eq(wallets.userId, userId),
        eq(transactionIntents.status, "awaiting_signature"),
        or(isNull(transactionIntents.expiresAt), gt(transactionIntents.expiresAt, now)),
      ),
    )
    .orderBy(desc(transactionIntents.createdAt));
}
