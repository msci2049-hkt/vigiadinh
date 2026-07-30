// Che email trước khi rời BE — MỘT nguồn cho mọi chỗ cần "nói đây là ai mà
// không thành máy tra email": sep45-session-plugin (B3 — "khoá này thuộc tài
// khoản khác") và chiều guardian của list-protecting (lô 30/07 — người bảo hộ
// thấy email chủ ví ở mức nhận ra được, không bao giờ thấy đầy đủ).
//
// Tách khỏi sep45-session-plugin vì file đó kéo cả hạ tầng Better Auth +
// modules/sep45 — domain thuần (list-protecting/domain.ts) import vào là test
// hermetic phải dựng env/db oan.
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const keep = Math.min(3, Math.max(1, local.length - 1));
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}
