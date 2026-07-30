// View "lệnh chờ TÔI ký" sang chiều CHỦ VÍ (lô vá L2) — THUẦN, khoá key-list
// như pendingApprovalView.
//
// KHÁC pendingApprovalView một điểm có chủ ý: view này chở địa chỉ người nhận
// ĐẦY ĐỦ, không rút gọn. Hai lý do, cả hai đều là bảo mật:
// 1. Người đọc là CHÍNH chủ ví — không có bí mật nào của bên thứ ba ở đây
//    (view guardian rút gọn vì guardian không cần biết chủ ví giao dịch với ai).
// 2. FE phải đối chiếu `to`/`amount`/`from` của auth entry TRƯỚC khi gọi passkey
//    (assertTransferEntry). Không có địa chỉ đầy đủ thì chống-ký-mù ở đường này
//    không chạy được, và ký mù chính là đường mất sạch ví.
// VẪN KHÔNG chở: challenge_hash (vật liệu binding server-side), số dư ví.
import type { AwaitingSignatureRow } from "../../infra/signing.repository";

export type PendingSignatureView = {
  intent_id: string;
  wallet_id: string;
  /** Ví nguồn — FE chốt `from` của entry vào đây. */
  from: string;
  /** Stroops dạng chuỗi (FE tự format XLM) — null nếu intent không phải chuyển tiền. */
  amount: string | null;
  recipient: string | null;
  /** Vì sao lệnh này từng phải chờ — FE render thành câu "người thân đã duyệt". */
  reasons: string[];
  created_at: Date;
  expires_at: Date | null;
};

export function pendingSignatureView(row: AwaitingSignatureRow): PendingSignatureView {
  return {
    intent_id: row.intentId,
    wallet_id: row.walletId,
    from: row.walletAddress,
    amount: row.amount === null ? null : row.amount.toString(),
    recipient: row.recipient,
    reasons: Array.isArray(row.reasons)
      ? row.reasons.filter((r): r is string => typeof r === "string")
      : [],
    created_at: row.createdAt,
    expires_at: row.expiresAt,
  };
}
