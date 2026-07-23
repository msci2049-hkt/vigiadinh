// Backward-compat là yêu cầu SỐNG CÒN: override hash KHÔNG được làm mật khẩu
// user cũ verify sai. Vector cố định dưới đây khoá params (N/r/p/dkLen) + format
// + NFKC. Nếu ai đổi params → test này GÃY ngay (chặn drift làm hỏng hash cũ).
import { describe, expect, it } from "bun:test";
import { hashPassword, verifyPassword } from "./password-hash";

// Vector sinh bằng node:crypto scrypt với params Better Auth (N=16384 r=16 p=1
// dkLen=64). password="correct-horse-battery-staple", salt cố định. Format
// "<saltHex32>:<keyHex128>" — GIỐNG HỆT Better Auth default.
const PW = "correct-horse-battery-staple";
const VECTOR =
  "00112233445566778899aabbccddeeff:624b60319359621867a8f3c1d870373b1849f59cd55d88914435202522d2906dd800a2b65518376d8d6720e6fffd2121198b04792d972870bab351f13526a392";

describe("password-hash (backward-compat + format)", () => {
  it("vector đúng độ dài: saltHex(32) + keyHex(128) — self-check chặn drift", () => {
    const [salt, key] = VECTOR.split(":");
    expect(salt?.length).toBe(32);
    expect(key?.length).toBe(128); // dkLen 64 byte = 128 hex; lệch → params sai
  });

  it("verify hash CŨ (vector cố định) → true (KHÔNG reset mật khẩu user)", async () => {
    expect(await verifyPassword({ hash: VECTOR, password: PW })).toBe(true);
  });

  it("verify hash cũ với sai mật khẩu → false", async () => {
    expect(await verifyPassword({ hash: VECTOR, password: "wrong-password-xx" })).toBe(false);
  });

  it("hash → verify roundtrip", async () => {
    const h = await hashPassword("a-brand-new-pass-1");
    expect(await verifyPassword({ hash: h, password: "a-brand-new-pass-1" })).toBe(true);
    expect(await verifyPassword({ hash: h, password: "a-brand-new-pass-2" })).toBe(false);
  });

  it("format đúng: saltHex(32):keyHex(128)", async () => {
    const h = await hashPassword("format-check-pass-1");
    expect(h).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("salt ngẫu nhiên mỗi lần → hash khác, vẫn verify đúng", async () => {
    const a = await hashPassword(PW);
    const b = await hashPassword(PW);
    expect(a).not.toBe(b); // salt khác → output khác
    expect(await verifyPassword({ hash: a, password: PW })).toBe(true);
    expect(await verifyPassword({ hash: b, password: PW })).toBe(true);
  });

  it("NFKC: cùng mật khẩu khác Unicode form vẫn verify (khớp Better Auth)", async () => {
    const composed = `café-secret-123`; // é precomposed (U+00E9)
    const decomposed = `café-secret-123`; // e + combining acute (U+0301)
    expect(composed).not.toBe(decomposed); // khác byte TRƯỚC khi normalize
    const h = await hashPassword(composed);
    expect(await verifyPassword({ hash: h, password: decomposed })).toBe(true);
  });

  it("hash hỏng/format lạ → false (không throw 500, không leak)", async () => {
    expect(await verifyPassword({ hash: "garbage", password: PW })).toBe(false);
    expect(await verifyPassword({ hash: "", password: PW })).toBe(false);
    expect(await verifyPassword({ hash: "onlysalt:", password: PW })).toBe(false);
    expect(await verifyPassword({ hash: ":onlykey", password: PW })).toBe(false);
    expect(await verifyPassword({ hash: "a:b:c", password: PW })).toBe(false);
  });
});
