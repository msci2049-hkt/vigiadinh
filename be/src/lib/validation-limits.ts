// WHY (D-052): nguồn sự thật DUY NHẤT cho các ngưỡng validate mà FE cũng cần.
// Class lỗi "hai nguồn sự thật": FE hardcode password min 8 trong khi BE enforce 12
// → user qua form, bị BE chửi "Password is too short" — thông báo khó hiểu ở tầng sau.
//
// Luồng: lib/auth.ts đọc các ngưỡng từ đây (không hardcode lại) → GET
// /api/config/validation (src/app.ts) expose cho FE fetch lúc boot → FE build
// Zod schema từ response (mau-demo-fe-vite: apps/web/src/lib/validation-limits.ts).
// Thêm ngưỡng mới cho form FE → thêm vào đây, KHÔNG hardcode số bên FE
// (guard check-validation-parity.mjs bên FE sẽ chặn).
export const VALIDATION_LIMITS = {
  password: {
    minLength: 12,
    maxLength: 128,
  },
  otp: {
    length: 6,
  },
} as const;

export type ValidationLimits = typeof VALIDATION_LIMITS;
