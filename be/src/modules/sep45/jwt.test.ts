// Test JWT ví — sign/verify roundtrip + tamper + hết hạn. Secret random mỗi lần chạy.
import { describe, expect, it } from "bun:test";
import { signWalletJwt, verifyWalletJwt } from "./jwt";
import type { WalletJwtClaims } from "./types";

const secret = crypto.randomUUID() + crypto.randomUUID();
const now = Math.floor(Date.now() / 1000);

const claims: WalletJwtClaims = {
  iss: "localhost:3000",
  sub: "C".padEnd(56, "A"),
  iat: now,
  exp: now + 3600,
  jti: "x".repeat(64),
  home_domain: "localhost:5173",
  device: "device-1234",
};

describe("sep45 jwt", () => {
  it("sign → verify roundtrip giữ đủ claims (sub = địa chỉ ví, device bind)", () => {
    const token = signWalletJwt(secret, claims);
    expect(verifyWalletJwt(secret, token)).toEqual(claims);
  });

  it("đổi 1 ký tự payload → null", () => {
    const token = signWalletJwt(secret, claims);
    const [h, p, s] = token.split(".") as [string, string, string];
    const tampered = `${h}.${p.slice(0, -2)}AA.${s}`;
    expect(verifyWalletJwt(secret, tampered)).toBeNull();
  });

  it("sai secret → null", () => {
    const token = signWalletJwt(secret, claims);
    expect(verifyWalletJwt("khac-secret-hoan-toan-1234567890", token)).toBeNull();
  });

  it("token hết hạn → null", () => {
    const token = signWalletJwt(secret, { ...claims, exp: now - 1 });
    expect(verifyWalletJwt(secret, token)).toBeNull();
  });

  it("chuỗi rác → null, không throw", () => {
    expect(verifyWalletJwt(secret, "abc")).toBeNull();
    expect(verifyWalletJwt(secret, "a.b.c")).toBeNull();
  });
});
