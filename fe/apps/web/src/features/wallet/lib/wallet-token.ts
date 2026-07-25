// JWT phiên ví (SEP-45) — Bearer-first (P1-9): token trong localStorage vì cookie
// sameSite chết trong WebView/extension. Đánh đổi XSS đã cân nhắc: CSP chặt khi
// deploy (nginx.conf) + token CHỈ mở được API ví (BE re-check mọi call), không
// đụng custody — custody nằm trên chuỗi, ký bằng passkey.
import { apiClient } from "@/lib/api-client";
import { registerSessionCleanup } from "@/lib/session-cleanup";

const STORAGE_KEY = "fw.wallet-jwt";

type WalletClaims = { sub: string; exp: number; device?: string };

function decodeClaims(token: string): WalletClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as WalletClaims;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return claims;
  } catch {
    return null;
  }
}

export function saveWalletToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
  apiClient.setAuthHeader(`Bearer ${token}`);
}

/** Token còn hạn, kèm claims — hết hạn/hỏng thì dọn sạch và trả null. */
export function loadWalletToken(): { token: string; claims: WalletClaims } | null {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) return null;
  const claims = decodeClaims(token);
  if (!claims || claims.exp <= Math.floor(Date.now() / 1000)) {
    clearWalletToken();
    return null;
  }
  return { token, claims };
}

export function clearWalletToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  apiClient.setAuthHeader(null);
}

/** Gọi MỘT lần lúc boot (main.tsx) — nối lại header Bearer nếu phiên ví còn hạn. */
export function restoreWalletSession(): void {
  const session = loadWalletToken();
  if (session) apiClient.setAuthHeader(`Bearer ${session.token}`);
}

// Đăng xuất phiên app thì phiên ví CŨNG phải chết — máy dùng chung mà JWT ví
// còn nằm trong localStorage là người sau gọi được API ví của người trước.
// (Module này được main.tsx nạp lúc boot nên đăng ký luôn luôn chạy.)
registerSessionCleanup(clearWalletToken);
