import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("giữ 2 ký tự đầu + domain — đủ để CHÍNH CHỦ nhận ra mình", () => {
    expect(maskEmail("abcdef@gmail.com")).toBe("ab***@gmail.com");
  });

  it("local 1 ký tự — không lộ thêm gì ngoài ký tự đó", () => {
    expect(maskEmail("a@x.vn")).toBe("a***@x.vn");
  });

  it("local đúng 2 ký tự — không độn thêm", () => {
    expect(maskEmail("ab@x.vn")).toBe("ab***@x.vn");
  });

  it("chuỗi không phải email → trả nguyên (không bịa dấu ***)", () => {
    expect(maskEmail("khong-phai-email")).toBe("khong-phai-email");
    expect(maskEmail("@dau-chuoi.vn")).toBe("@dau-chuoi.vn");
  });
});
