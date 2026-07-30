// 🔴 Hai ca 401 phải PHÂN BIỆT được (luật lô 30/07): WALLET_SESSION_REVOKED
// → dọn token ví; mã khác (UNAUTHENTICATED…) → KHÔNG dọn, nếu không phiên ví
// Bearer-first của WebView/APK bị đăng xuất oan khi chỉ session app hết hạn.
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { isWalletSessionRevokedError } from "./session-revoked";

function err401(data: unknown): ApiError {
  return new ApiError("Unauthorized", 401, data);
}

describe("isWalletSessionRevokedError", () => {
  it("envelope app {error:{code}} (middleware wallet-session qua onError) → true", () => {
    expect(
      isWalletSessionRevokedError(
        err401({ error: { code: "WALLET_SESSION_REVOKED", message: "WALLET_SESSION_REVOKED" } }),
      ),
    ).toBe(true);
  });

  it("shape Better Auth {message} trần (endpoint sep45/*) → true", () => {
    expect(isWalletSessionRevokedError(err401({ message: "WALLET_SESSION_REVOKED" }))).toBe(true);
  });

  it("401 mã KHÁC (UNAUTHENTICATED) → false — không dọn token oan", () => {
    expect(
      isWalletSessionRevokedError(
        err401({ error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" } }),
      ),
    ).toBe(false);
    expect(isWalletSessionRevokedError(err401({ message: "UNAUTHENTICATED" }))).toBe(false);
  });

  it("body rỗng / không phải ApiError / undefined → false", () => {
    expect(isWalletSessionRevokedError(err401(null))).toBe(false);
    expect(isWalletSessionRevokedError(new Error("WALLET_SESSION_REVOKED"))).toBe(false);
    expect(isWalletSessionRevokedError(undefined)).toBe(false);
  });
});
