// WHY: Chống tự-phong-role (privilege escalation) qua public sign-up — tách
// thành module thuần (không import nặng) để test độc lập với init Better Auth.
// Dùng bởi databaseHooks.user.create.before trong src/lib/auth.ts (Lớp 2).
//
// BẤT BIẾN: role nhạy cảm (admin, ...) KHÔNG BAO GIỜ đến từ client sign-up —
// server sở hữu role. Chi tiết + anti-pattern CẤM: .claude/rules/auth.md.

/** Role mà đăng ký CÔNG KHAI (untrusted) được phép tự nhận. Mọi giá trị khác → "user". */
export const PUBLIC_SIGNUP_ROLES = new Set<string>(["user"]);

/** Endpoint path coi là public sign-up (nguồn untrusted). Bật OAuth → thêm callback
 * social sign-up (skill add-oauth). admin API (/admin/create-user) + seed KHÔNG nằm
 * ở đây → role do server authorize được GIỮ NGUYÊN. */
export const PUBLIC_SIGNUP_PATHS = new Set<string>(["/sign-up/email"]);

/**
 * Ép role về whitelist CHỈ khi nguồn là public sign-up (phân biệt qua `path`).
 * - path ∈ PUBLIC_SIGNUP_PATHS → role hợp lệ giữ nguyên, role lạ (admin/staff/…) → "user".
 * - path khác (admin.createUser) hoặc undefined (tạo nội bộ) → GIỮ NGUYÊN role.
 *
 * ⚠️ Ép role vô điều kiện = PHÁ admin.createUser. Phân biệt `path` là BẮT BUỘC.
 */
export function enforcePublicSignupRole<T extends Record<string, unknown>>(
  userData: T,
  path: string | undefined,
): T {
  if (!path || !PUBLIC_SIGNUP_PATHS.has(path)) return userData;
  const incoming = userData.role;
  const role =
    typeof incoming === "string" && PUBLIC_SIGNUP_ROLES.has(incoming) ? incoming : "user";
  return { ...userData, role };
}
