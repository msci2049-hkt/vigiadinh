// Đổi JWT ví (SEP-45) lấy SESSION APP — tách khỏi sep45-login.ts CÓ CHỦ Ý.
//
// sep45-login.ts kéo theo `getWalletKit` → `smart-account-kit`, mà gói đó chạy
// hashing NGAY LÚC IMPORT (policy-clients) và vỡ dưới jsdom/vitest ("expected
// Uint8Array"). Phần exchange chỉ cần apiClient nên để riêng đây → test được
// mà không phải nạp cả kit. Đây cũng là tách trách nhiệm đúng: đổi-session là
// HTTP thuần, không đụng passkey.
import { ApiError, apiClient } from "@/lib/api-client";

/**
 * Cửa đổi từ chối — mang mã + email che (nếu là ví của tài khoản khác) để màn
 * passkey nói đúng câu thay vì "lỗi chung". KHÔNG rơi về Sep45LoginError: hai
 * lớp lỗi khác nhau về hành động tiếp theo (thử lại vs đăng xuất/đổi khoá).
 */
export class SessionExchangeError extends Error {
  // erasableSyntaxOnly: khai field tường minh, không dùng parameter properties.
  readonly code: "walletUnknown" | "belongsToOther" | "revoked" | "generic";
  readonly maskedEmail: string | undefined;

  constructor(code: SessionExchangeError["code"], maskedEmail?: string) {
    super(code);
    this.name = "SessionExchangeError";
    this.code = code;
    this.maskedEmail = maskedEmail;
  }
}

/** Body lỗi của endpoint Better Auth: `{message}` — KHÔNG phải envelope app. */
function exchangeErrorOf(err: unknown): SessionExchangeError {
  if (!(err instanceof ApiError)) return new SessionExchangeError("generic");
  const message = (err.data as { message?: string } | null)?.message ?? "";
  if (message.startsWith("WALLET_BELONGS_TO_OTHER_ACCOUNT")) {
    const masked = message.split(":")[1];
    return new SessionExchangeError("belongsToOther", masked || undefined);
  }
  if (message === "WALLET_UNKNOWN") return new SessionExchangeError("walletUnknown");
  if (message === "WALLET_SESSION_REVOKED") return new SessionExchangeError("revoked");
  return new SessionExchangeError("generic");
}

/**
 * JWT ví (vừa phát, còn TƯƠI — BE chối token quá 5 phút) → session app của chủ
 * ví, scope đúng ví đã ký. Better Auth set cookie qua Set-Cookie của response
 * này; caller chỉ cần xoá cache session của router là cổng `_authenticated` mở.
 */
export async function exchangeForAppSession(token: string): Promise<void> {
  try {
    await apiClient.post("/api/auth/sep45/exchange", { token });
  } catch (err) {
    throw exchangeErrorOf(err);
  }
}
