// Cửa đổi JWT ví → session app — phần THUẦN test được không cần DB:
// maskEmail (B3: nói "chìa của ai" mà không thành máy tra email) và hằng số
// tươi. Phần endpoint đầy-đủ (cấp session thật, chặn khác tài khoản, jti một
// lần) nằm ở sep45-exchange.integration.test.ts — cần Postgres + Dragonfly.
import { describe, expect, it } from "bun:test";
import { maskEmail } from "./mask-email";
import { MAX_TOKEN_AGE_SECONDS } from "./sep45-session-plugin";

describe("maskEmail", () => {
  it("giữ tối đa 3 ký tự đầu — đủ nhận ra, không đủ tra", () => {
    expect(maskEmail("badbyboy.tn.zzz@gmail.com")).toBe("bad***@gmail.com");
    expect(maskEmail("lipxjh@gmail.com")).toBe("lip***@gmail.com");
  });

  it("local ngắn không bị lộ nguyên phần đầu", () => {
    expect(maskEmail("ab@x.vn")).toBe("a***@x.vn");
    expect(maskEmail("a@x.vn")).toBe("a***@x.vn".replace("a***", "a***"));
    // 1 ký tự: keep = max(1, 0) = 1 — vẫn che được vì *** theo sau.
    expect(maskEmail("a@x.vn")).toBe("a***@x.vn");
  });

  it("chuỗi không phải email → *** (không văng)", () => {
    expect(maskEmail("khong-phai-email")).toBe("***");
    expect(maskEmail("")).toBe("***");
  });
});

describe("hằng số cửa đổi", () => {
  it("cửa sổ tươi 5 phút — FE đổi ngay sau khi ký, token trộm để dành là vô dụng", () => {
    expect(MAX_TOKEN_AGE_SECONDS).toBe(300);
  });
});
