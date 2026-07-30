// Nhận diện 401 WALLET_SESSION_REVOKED — JWT ví trong localStorage đã chết
// (ví bị xoá/khôi phục xoay khoá) nhưng vẫn được gắn Bearer vào mọi request.
// Handler 401 của app (provider.tsx) dùng hàm này để quyết định dọn token +
// retry; wallet-session.ts BE dặn rõ: FE phân biệt mã này với UNAUTHENTICATED
// và "xoá localStorage rồi chạy lại SEP-45" — vế FE đó chính là đây (sự cố
// 30/07: token chết sau TRUNCATE khoá người dùng 24h không đường thoát).
//
// Hai shape body phải nhận đủ: route app đi qua onError → envelope
// `{error:{code}}` (be/src/middlewares/error.ts), endpoint Better Auth
// (sep45/*) trả `{message}` trần — thiếu một vế là lỗ chui lại.
import { ApiError } from "@/lib/api-client";

export function isWalletSessionRevokedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const data = error.data as
    | { message?: unknown; error?: { code?: unknown } | null }
    | null
    | undefined;
  return (
    data?.message === "WALLET_SESSION_REVOKED" || data?.error?.code === "WALLET_SESSION_REVOKED"
  );
}
