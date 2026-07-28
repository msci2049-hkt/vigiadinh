// Sanitize ?redirect — MỘT chỗ cho cả /login, /sign-up và /verify-email.
// Chỉ nhận đường dẫn nội bộ tuyệt đối; URL ngoài / protocol-relative
// (?redirect=https://evil.com, //evil.com, /\evil.com) bị bỏ — chống open
// redirect sau khi đăng nhập/đăng ký (cùng luật với schema cũ ở /login).
export function sanitizeRedirect(to: string | undefined): string | undefined {
  return to?.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : undefined;
}
