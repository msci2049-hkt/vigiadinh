// View màn "Ví tôi đang gác" (C7) — THUẦN, khoá key-list như publicInviteView:
// hàm chỉ NHẬN đúng các cột an toàn, về mặt kiểu không có chỗ cho email /
// địa chỉ ví / số dư của chủ ví lọt ra chiều guardian.

export type ProtectingRow = {
  id: string;
  walletId: string;
  status: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  ownerName: string | null;
};

export type ProtectingItemView = {
  id: string;
  wallet_id: string;
  status: string;
  owner_name: string | null;
  protecting_since: Date;
  last_seen_at: Date | null;
};

export function protectingItemView(row: ProtectingRow): ProtectingItemView {
  return {
    id: row.id,
    wallet_id: row.walletId,
    status: row.status,
    owner_name: row.ownerName,
    protecting_since: row.createdAt,
    last_seen_at: row.lastSeenAt,
  };
}
