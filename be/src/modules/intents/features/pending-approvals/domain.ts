// View phiếu chờ duyệt sang chiều GUARDIAN (LÔ 1 A5) — THUẦN, khoá key-list
// như protectingItemView: về mặt kiểu không có chỗ cho challenge_hash / địa chỉ
// ví đầy đủ / số dư lọt sang. amount = chuỗi stroops (FE tự format XLM).
import { shortAddress } from "../../domain/format";
import type { PendingApprovalRow } from "../../infra/approvals.repository";

export type PendingApprovalView = {
  approval_id: string;
  intent_id: string;
  wallet_id: string;
  owner_name: string | null;
  amount: string | null;
  recipient_short: string;
  reasons: string[];
  expires_at: Date;
};

export function pendingApprovalView(row: PendingApprovalRow): PendingApprovalView {
  return {
    approval_id: row.approvalId,
    intent_id: row.intentId,
    wallet_id: row.walletId,
    owner_name: row.ownerName,
    amount: row.amount === null ? null : row.amount.toString(),
    recipient_short: shortAddress(row.recipient),
    reasons: Array.isArray(row.reasons)
      ? row.reasons.filter((r): r is string => typeof r === "string")
      : [],
    expires_at: row.expiresAt,
  };
}
