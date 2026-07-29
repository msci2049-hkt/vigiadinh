// Scope ví của session passkey — hai chiều đều phải đúng:
// chặn ĐÚNG ví lạ (passkey A không hành động trên B), và KHÔNG chặn oan
// session email/OTP (scope null = hành vi cũ, nếu vỡ là mọi người dùng email
// mất quyền trên chính ví của họ).
import { describe, expect, it } from "bun:test";
import { HTTPException } from "hono/http-exception";
import { assertWalletScope, walletScopeAllows } from "./wallet-scope";

const A = "01WALLETAAAAAAAAAAAAAAAAAA";
const B = "01WALLETBBBBBBBBBBBBBBBBBB";

describe("walletScopeAllows", () => {
  it("session email/OTP (không scope) → cho qua mọi ví của user", () => {
    expect(walletScopeAllows(null, A)).toBe(true);
    expect(walletScopeAllows(undefined, A)).toBe(true);
    expect(walletScopeAllows({}, A)).toBe(true);
    expect(walletScopeAllows({ activeWalletId: null }, A)).toBe(true);
  });

  it("session passkey ví A → chỉ ví A qua, ví B bị chối", () => {
    expect(walletScopeAllows({ activeWalletId: A }, A)).toBe(true);
    expect(walletScopeAllows({ activeWalletId: A }, B)).toBe(false);
  });
});

describe("assertWalletScope", () => {
  it("ví ngoài scope → 403 WALLET_OUT_OF_SCOPE (mã riêng, không phải NOT_OWNER)", () => {
    try {
      assertWalletScope({ activeWalletId: A }, B);
      throw new Error("phải ném");
    } catch (err) {
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(403);
      expect((err as HTTPException).message).toBe("WALLET_OUT_OF_SCOPE");
    }
  });

  it("đúng ví / không scope → im lặng", () => {
    expect(() => assertWalletScope({ activeWalletId: A }, A)).not.toThrow();
    expect(() => assertWalletScope(null, B)).not.toThrow();
  });
});
