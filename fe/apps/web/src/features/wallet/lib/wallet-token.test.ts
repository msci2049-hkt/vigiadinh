// Mock apiClient — test chỉ quan tâm storage + expiry + wiring setAuthHeader.
import { beforeEach, describe, expect, it, vi } from "vitest";

const setAuthHeader = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiClient: { setAuthHeader } }));

const { clearWalletToken, loadWalletToken, restoreWalletSession, saveWalletToken } = await import(
  "./wallet-token"
);

function fakeJwt(claims: Record<string, unknown>): string {
  // btoa (jsdom) thay Buffer — code src typecheck không có node types.
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.${"x".repeat(43)}`;
}

const now = Math.floor(Date.now() / 1000);

describe("wallet-token", () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthHeader.mockClear();
  });

  it("save → load giữ claims + gắn header Bearer", () => {
    const token = fakeJwt({ sub: `C${"A".repeat(55)}`, exp: now + 3600, device: "d-1" });
    saveWalletToken(token);
    expect(setAuthHeader).toHaveBeenCalledWith(`Bearer ${token}`);
    const loaded = loadWalletToken();
    expect(loaded?.claims.sub).toBe(`C${"A".repeat(55)}`);
    expect(loaded?.claims.device).toBe("d-1");
  });

  it("token hết hạn → load trả null và tự dọn", () => {
    saveWalletToken(fakeJwt({ sub: "C1", exp: now - 10 }));
    expect(loadWalletToken()).toBeNull();
    expect(localStorage.getItem("fw.wallet-jwt")).toBeNull();
    expect(setAuthHeader).toHaveBeenLastCalledWith(null);
  });

  it("clear gỡ token + header", () => {
    saveWalletToken(fakeJwt({ sub: "C1", exp: now + 100 }));
    clearWalletToken();
    expect(loadWalletToken()).toBeNull();
    expect(setAuthHeader).toHaveBeenLastCalledWith(null);
  });

  it("restoreWalletSession nối lại header khi còn phiên", () => {
    const token = fakeJwt({ sub: "C1", exp: now + 100 });
    saveWalletToken(token);
    setAuthHeader.mockClear();
    restoreWalletSession();
    expect(setAuthHeader).toHaveBeenCalledWith(`Bearer ${token}`);
  });

  it("token rác → null, không throw", () => {
    localStorage.setItem("fw.wallet-jwt", "khong-phai-jwt");
    expect(loadWalletToken()).toBeNull();
  });
});
