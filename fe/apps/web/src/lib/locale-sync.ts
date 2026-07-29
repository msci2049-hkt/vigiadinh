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
