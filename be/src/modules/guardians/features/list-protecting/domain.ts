// View màn "Ví tôi đang gác" (C7) — THUẦN, khoá key-list như publicInviteView:
// hàm chỉ NHẬN đúng các cột an toàn, về mặt kiểu không có chỗ cho địa chỉ ví /
// số dư của chủ ví lọt ra chiều guardian.
//
// Mở khoá CÓ CHỦ ĐÍCH 30/07: thêm đúng MỘT field `owner_email_masked` — email
// che ("ab***@gmail.com") để guardian phân biệt được hai chủ ví trùng tên.
// Che NGAY TẠI VIEW (maskEmail), bản đầy đủ không bao giờ vào response; key-list
// test cập nhật cùng commit, đó chính là nghi thức "tự trả lời trường này có an
// toàn không" mà test đặt ra.
//
// Mở khoá CÓ CHỦ ĐÍCH lô R1: thêm đúng MỘT field `stellar_address` — ĐỦ 56 ký
// tự, KHÔNG rút gọn. Người mất máy không nhớ nổi 56 ký tự base32 và app chưa có
// đường tra ví bằng email, nên "gọi người thân đọc hộ địa chỉ" là đường thoát
// DUY NHẤT — rút gọn ở đây là bịt nốt nó. Địa chỉ ví là dữ liệu public trên
// chain: hiện nó KHÔNG phá lời hứa ở /passkey ("bạn không xem được số dư hay
// hoạt động của họ"), vì số dư và lịch sử vẫn không có chỗ trong kiểu này.
import { maskEmail } from "@/lib/mask-email";

export type ProtectingRow = {
  id: string;
  walletId: string;
  stellarAddress: string;
  status: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  ownerName: string | null;
  ownerEmail: string;
};

export type ProtectingItemView = {
  id: string;
  wallet_id: string;
  stellar_address: string;
  status: string;
  owner_name: string | null;
  owner_email_masked: string;
  protecting_since: Date;
  last_seen_at: Date | null;
};

export function protectingItemView(row: ProtectingRow): ProtectingItemView {
  return {
    id: row.id,
    wallet_id: row.walletId,
    stellar_address: row.stellarAddress,
    status: row.status,
    owner_name: row.ownerName,
    owner_email_masked: maskEmail(row.ownerEmail),
    protecting_since: row.createdAt,
    last_seen_at: row.lastSeenAt,
  };
}
