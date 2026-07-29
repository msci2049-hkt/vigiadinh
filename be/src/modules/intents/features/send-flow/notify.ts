// Thông báo của luồng gửi tiền (LÔ 1 A5 — vá chỗ đứt "intent vào
// awaiting_guardian rồi im lặng tuyệt đối").
//
// Hai luật:
// 1. FIRE-AND-FORGET — enqueue chỉ là INSERT bảng notifications; lỗi ở đây
//    KHÔNG được làm hỏng luồng tiền. Bắt hết, log, đi tiếp.
// 2. KÊNH: email + sse. KHÔNG push — FCM chưa cấu hình (PUSH_NOT_CONFIGURED),
//    enqueue push bây giờ chỉ đốt lượt retry của dispatcher.
// Payload KHÔNG chở secret: không token, không challenge_hash, không địa chỉ
// đầy đủ — chỉ tên chủ ví, số tiền, đuôi địa chỉ, số giờ còn hạn.
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/modules/notifications";
import { formatXlm, shortAddress } from "../../domain/format";
import {
  guardianUserIdsForWallet,
  ownerNameForWallet,
  ownerUserIdForWallet,
} from "../../infra/approvals.repository";

const CHANNELS = ["email", "sse"] as const;

/** Lệnh vào awaiting_guardian → báo TỪNG guardian của ví (template approval.requested). */
export async function notifyGuardiansApprovalRequested(input: {
  walletId: string;
  amount: bigint | null;
  recipient: string | null;
  expiresAt: Date;
}): Promise<void> {
  try {
    const [guardianUserIds, ownerName] = await Promise.all([
      guardianUserIdsForWallet(input.walletId),
      ownerNameForWallet(input.walletId),
    ]);
    if (guardianUserIds.length === 0) {
      logger.warn({ walletId: input.walletId }, "send.notify.no-guardian-user");
      return;
    }
    const params = {
      // "unknown" khớp nhánh select trong template — render thành chuỗi trung
      // tính theo đúng locale người nhận, không nhét fallback tiếng Anh vào đây.
      ownerName: ownerName?.trim() ? ownerName : "unknown",
      amount: formatXlm(input.amount),
      recipient: shortAddress(input.recipient),
      hours: Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 3_600_000)),
    };
    for (const userId of guardianUserIds) {
      for (const channel of CHANNELS) {
        await enqueueNotification({ userId, templateKey: "approval.requested", params, channel });
      }
    }
  } catch (err) {
    logger.error({ err, walletId: input.walletId }, "send.notify.approval-requested.failed");
  }
}

/** Guardian đã quyết → báo CHỦ VÍ (approve: đi ký tiếp · reject: tiền đứng yên). */
export async function notifyOwnerGuardianDecision(input: {
  walletId: string;
  decision: "approved" | "rejected";
}): Promise<void> {
  try {
    const ownerUserId = await ownerUserIdForWallet(input.walletId);
    if (!ownerUserId) return;
    const templateKey = input.decision === "approved" ? "approval.approved" : "approval.rejected";
    for (const channel of CHANNELS) {
      await enqueueNotification({ userId: ownerUserId, templateKey, channel });
    }
  } catch (err) {
    logger.error({ err, walletId: input.walletId }, "send.notify.guardian-decision.failed");
  }
}
