// slugifyLabel — tên file tải xuống. Canvas không test được trong jsdom
// (toBlob không có) — phần vẽ verify bằng mắt ở test tay ca 9.
import { describe, expect, it } from "vitest";
import { slugifyLabel } from "./invite-image";

describe("slugifyLabel — tên file bỏ dấu, an toàn", () => {
  it("bỏ dấu tiếng Việt + đ→d, khoảng trắng thành gạch nối", () => {
    expect(slugifyLabel("Mẹ")).toBe("me");
    expect(slugifyLabel("Anh Hai")).toBe("anh-hai");
    expect(slugifyLabel("Dì Út đó")).toBe("di-ut-do");
  });

  it("ký tự ngoài chữ-số bị thay bằng gạch nối, không kẹp đầu đuôi", () => {
    expect(slugifyLabel("  Bà ngoại!! ")).toBe("ba-ngoai");
  });

  it("nhãn toàn ký tự lạ (chữ Hán…) → fallback, không ra tên file rỗng", () => {
    expect(slugifyLabel("妈妈")).toBe("nguoi-than");
  });
});
