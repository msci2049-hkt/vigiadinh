import { describe, expect, it } from "bun:test";
import { protectingItemView } from "./domain";

describe("protectingItemView — chiều guardian KHÔNG rò dữ liệu chủ ví (C7)", () => {
  const ADDRESS = "CAEDGA447G2JCTFPN2YNEGPGTCBMXYHCS324IOVC3A35KD7UNUZOQHBY";
  const row = {
    id: "01TEST0000000000000000GRD1",
    walletId: "01TEST0000000000000000WLT1",
    stellarAddress: ADDRESS,
    status: "active",
    createdAt: new Date("2026-07-28T00:00:00Z"),
    lastSeenAt: null,
    ownerName: "Huy",
    ownerEmail: "huy.owner.zzz@gmail.com",
  };

  it("chốt danh sách key — thêm trường mới vào đường guardian là test này ĐỎ, buộc người sửa tự trả lời 'trường này có an toàn không'", () => {
    const view = protectingItemView(row);
    // 30/07: mở khoá CÓ CHỦ ĐÍCH duy nhất `owner_email_masked` (email ĐÃ che
    // ngay tại view) — guardian phân biệt được hai chủ ví trùng tên.
    // Lô R1: mở khoá CÓ CHỦ ĐÍCH duy nhất `stellar_address` — chủ ví mất máy
    // không nhớ nổi 56 ký tự và app chưa có đường tra ví bằng email, nên
    // "gọi người thân đọc hộ" là đường thoát duy nhất. Địa chỉ vốn public
    // trên chain. Vẫn KHÔNG số dư, KHÔNG lịch sử, KHÔNG email đầy đủ.
    expect(Object.keys(view).sort()).toEqual([
      "id",
      "last_seen_at",
      "owner_email_masked",
      "owner_name",
      "protecting_since",
      "status",
      "stellar_address",
      "wallet_id",
    ]);
  });

  it("địa chỉ ví ĐỦ 56 ký tự — rút gọn ở đây là bịt nốt đường thoát duy nhất", () => {
    const view = protectingItemView(row);
    expect(view.stellar_address).toBe(ADDRESS);
    expect(view.stellar_address).toHaveLength(56);
    expect(view.stellar_address).not.toContain("…");
  });

  it("KHÔNG số dư, KHÔNG lịch sử — lời hứa ở /passkey còn nguyên", () => {
    const view = protectingItemView(row);
    // Lời hứa: "Bạn không xem được số dư hay hoạt động của họ" (fw.json:162).
    // Địa chỉ ví KHÁC số dư: địa chỉ là dữ liệu public trên chain, số dư và
    // lịch sử thì chỉ chủ ví thấy trong app này.
    const keys = Object.keys(view);
    for (const banned of ["balance", "balances", "amount", "history", "activity", "intents"]) {
      expect(keys).not.toContain(banned);
    }
    // Chốt bằng cả kiểu lẫn giá trị: không có số nào ngoài ngày tháng đi qua.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("XLM");
    expect(serialized).not.toContain("stroop");
  });

  it("email bị CHE ngay tại view — bản đầy đủ không xuất hiện ở bất kỳ đâu trong response", () => {
    const view = protectingItemView(row);
    expect(view.owner_email_masked).toBe("huy***@gmail.com");
    expect(JSON.stringify(view)).not.toContain("huy.owner.zzz@gmail.com");
  });

  it("owner_name = đúng MỘT cột user.name; chưa từng hoạt động → last_seen_at null, không bịa số", () => {
    const view = protectingItemView(row);
    expect(view.owner_name).toBe("Huy");
    expect(view.last_seen_at).toBeNull();
    expect(view.protecting_since).toEqual(new Date("2026-07-28T00:00:00Z"));
  });
});
