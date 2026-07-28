import { describe, expect, it } from "bun:test";
import { protectingItemView } from "./domain";

describe("protectingItemView — chiều guardian KHÔNG rò dữ liệu chủ ví (C7)", () => {
  const row = {
    id: "01TEST0000000000000000GRD1",
    walletId: "01TEST0000000000000000WLT1",
    status: "active",
    createdAt: new Date("2026-07-28T00:00:00Z"),
    lastSeenAt: null,
    ownerName: "Huy",
  };

  it("chốt danh sách key — thêm trường mới vào đường guardian là test này ĐỎ, buộc người sửa tự trả lời 'trường này có an toàn không'", () => {
    const view = protectingItemView(row);
    expect(Object.keys(view).sort()).toEqual([
      "id",
      "last_seen_at",
      "owner_name",
      "protecting_since",
      "status",
      "wallet_id",
    ]);
  });

  it("owner_name = đúng MỘT cột user.name; chưa từng hoạt động → last_seen_at null, không bịa số", () => {
    const view = protectingItemView(row);
    expect(view.owner_name).toBe("Huy");
    expect(view.last_seen_at).toBeNull();
    expect(view.protecting_since).toEqual(new Date("2026-07-28T00:00:00Z"));
  });
});
