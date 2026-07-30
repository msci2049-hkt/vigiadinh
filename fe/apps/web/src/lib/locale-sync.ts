// Đổi ngôn ngữ = đổi CẢ hai nơi (LÔ 1 — fix "email an ninh tiếng Anh cho người Việt"):
// 1. i18n client (language detector tự lưu localStorage);
// 2. user.locale trên BE (Better Auth update-user) — notification-dispatch render
//    email/push theo cột này, vì lúc gửi thư người nhận KHÔNG mở app.
// Fire-and-forget: chưa đăng nhập / mạng lỗi thì bỏ qua — UI vẫn đổi ngay,
// lần đổi sau (khi đã đăng nhập) sẽ ghi được.
import { apiClient } from "./api-client";
import i18n from "./i18n";

export async function changeAppLanguage(code: string): Promise<void> {
  await i18n.changeLanguage(code);
  void apiClient.post("/api/auth/update-user", { locale: code }).catch(() => {});
}

let syncedThisLoad = false;

/**
 * R4-D3 — gọi khi ĐÃ có phiên: đẩy ngôn ngữ đang hiển thị lên `user.locale` nếu
 * server chưa khớp. Thiếu bước này, người chưa từng bấm đổi ngôn ngữ có
 * `user.locale` NULL → notification-dispatch render email an ninh bằng 'en' dù
 * UI của họ đang tiếng Việt (đo 31/07: email guardian recovery.device_requested
 * ra tiếng Anh trong khi email chủ ví — người từng đổi ngôn ngữ — đúng vi).
 */
export function ensureLocaleSynced(serverLocale: string | null | undefined): void {
  if (syncedThisLoad) return;
  const current = i18n.language?.split("-")[0];
  if (!current) return;
  if (serverLocale && serverLocale.split("-")[0] === current) {
    syncedThisLoad = true;
    return;
  }
  syncedThisLoad = true;
  void apiClient.post("/api/auth/update-user", { locale: current }).catch(() => {
    // Mạng lỗi → để lần điều hướng sau thử lại.
    syncedThisLoad = false;
  });
}
