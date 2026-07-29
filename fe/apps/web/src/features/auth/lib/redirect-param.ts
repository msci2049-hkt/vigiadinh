// Sanitize ?redirect — MỘT chỗ cho cả /login, /sign-up và /verify-email.
// Chỉ nhận đường dẫn nội bộ tuyệt đối; URL ngoài / protocol-relative
// (?redirect=https://evil.com, //evil.com, /\evil.com) bị bỏ — chống open
// redirect sau khi đăng nhập/đăng ký (cùng luật với schema cũ ở /login).

/**
 * Các trang AUTH — đích mà `?redirect` KHÔNG được trỏ tới.
 *
 * Sự cố production 29/07: URL thật quan sát được là
 * `/login?redirect=%2Flogin%3Fredirect%3D%252F` — tức `/login?redirect=/login?redirect=/`,
 * mỗi vòng mã hoá thêm một tầng. `/login?…` là đường nội bộ hợp lệ nên lọt qua
 * cửa chống open-redirect; thứ thiếu là cửa chống TỰ TRỎ VÀO CHÍNH MÌNH.
 *
 * Danh sách khai ở ĐÂY và chỉ ở đây — nơi khác import vào (route guard, handler
 * 401). Khai hai nơi là sớm muộn lệch nhau và lỗ hổng quay lại.
 */
export const AUTH_PATHS = ["/login", "/sign-up", "/verify-email", "/reset-password"] as const;

/** Pathname hiện tại có đang là một trang auth không (khớp theo TIỀN TỐ). */
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function sanitizeRedirect(to: string | undefined): string | undefined {
  if (!to?.startsWith("/") || to.startsWith("//") || to.startsWith("/\\")) return undefined;
  // Cắt query/hash trước khi so: `/login?redirect=…` phải bị chặn, không chỉ `/login`.
  const path = to.split(/[?#]/)[0] ?? "";
  if (isAuthPath(path)) return undefined;
  return to;
}

/** Quyết định khi apiClient gặp 401. `navigate:false` = ở nguyên chỗ cũ. */
export type UnauthorizedNav =
  | { navigate: false }
  | { navigate: true; redirect: string | undefined };

/**
 * Gặp 401 thì đi đâu — THUẦN, để test được mà không phải dựng router.
 *
 * Đang đứng trên trang auth thì KHÔNG đi đâu cả: người dùng vốn đã ở đúng nơi cần
 * đăng nhập, đá thêm một lần nữa chỉ để lồng `?redirect=` vào chính nó.
 */
export function unauthorizedNavigation(loc: { pathname: string; search: string }): UnauthorizedNav {
  if (isAuthPath(loc.pathname)) return { navigate: false };
  return { navigate: true, redirect: sanitizeRedirect(loc.pathname + loc.search) };
}
