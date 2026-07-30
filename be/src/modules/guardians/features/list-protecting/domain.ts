// View màn "Ví tôi đang gác" (C7) — THUẦN, khoá key-list như publicInviteView:
// hàm chỉ NHẬN đúng các cột an toàn, về mặt kiểu không có chỗ cho địa chỉ ví /
// số dư của chủ ví lọt ra chiều guardian.
//
// Mở khoá CÓ CHỦ ĐÍCH 30/07: thêm đúng MỘT field `owner_email_masked` — email
// che ("ab***@gmail.com") để guardian phân biệt được hai chủ ví trùng tên.
// Che NGAY TẠI VIEW (maskEmail), bản đầy đủ không bao giờ vào response; key-list
// test cập nhật cùng commit, đó chính là nghi thức "tự trả lời trường này có an
// toàn không" mà test đặt ra.
import { maskEmail } from "@/lib/mask-email";

export type ProtectingRow = {
  id: string;
  walletId: string;
  status: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  ownerName: string | null;
  ownerEmail: string;
};

export type ProtectingItemView = {
  id: string;
  wallet_id: string;
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
    status: row.status,
    owner_name: row.ownerName,
    owner_email_masked: maskEmail(row.ownerEmail),
    protecting_since: row.createdAt,
    last_seen_at: row.lastSeenAt,
  };
}
