// Che email trước khi hiện trên trang NHẬN LỜI MỜI — THUẦN, test hermetic.
//
// Vì sao phải che (A5 lô 30/07): trang accept là trang mở từ link lạ, thường
// trên máy DÙNG CHUNG của gia đình. "Bạn đang đăng nhập là <email đầy đủ>" trên
// máy chung là đưa địa chỉ email của người trước cho người sau đọc — đủ để dò
// mật khẩu hoặc lừa đảo nhắm đúng người. Người ĐÚNG chỉ cần hai ký tự đầu +
// domain là nhận ra mình; người KHÁC thì không lấy được gì.
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`;
}
