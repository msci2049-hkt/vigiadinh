// Lệnh của CHÍNH chủ ví đang chờ họ ký — GET /api/intents/pending-signature.
//
// Vì sao tồn tại (lô vá L2): người thân duyệt xong, BE mở khoá ký rồi dừng —
// custody trên chuỗi, chữ ký passkey của chủ ví vẫn là thứ duy nhất chuyển được
// tiền. Trước lô này `intentId` chỉ sống trong state của tab đang mở: đóng tab
// hay F5 là mất, lệnh nằm im tới khi hết hạn 24h. Đây là đường khám phá lại.
//
// KHÁC pending-approvals (chiều guardian): view này chở địa chỉ người nhận ĐẦY
// ĐỦ và địa chỉ ví nguồn — bắt buộc, vì FE phải đối chiếu entry với chúng TRƯỚC
// khi gọi passkey (assertTransferEntry). Người đọc là chính chủ ví nên không có
// bí mật của bên thứ ba nào bị lộ thêm.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type PendingSignature = {
  intent_id: string;
  wallet_id: string;
  /** Ví nguồn (C…) — chốt `from` của auth entry vào đây. */
  from: string;
  /** Chuỗi stroops; null = intent không phải chuyển tiền. */
  amount: string | null;
  recipient: string | null;
  reasons: string[];
  created_at: string;
  expires_at: string | null;
};

export const pendingSignatureKeys = { all: ["family", "pending-signature"] as const };

export const pendingSignatureOptions = queryOptions({
  queryKey: pendingSignatureKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: PendingSignature[] }>("/api/intents/pending-signature");
    return res.data;
  },
  // SSE là at-most-once và đã từng chết cả kênh (lô SSE idle-timeout). Quay lại
  // tab là tự cập nhật — lưới đỡ thứ hai, giống pending-approvals.
  refetchOnWindowFocus: true,
});
