// WHY: Single source of truth cho Better Auth. Sau khi sửa file này MUST chạy
// theo thứ tự: bun run auth:generate → bun run db:generate → bun run db:migrate
// (đảo thứ tự = migration không có bảng plugin mới — theo .claude/rules/auth.md).
//
// Production-grade defaults (mọi dự án cần):
// - secondaryStorage Dragonfly (prod) → tăng tốc session lookup
// - cookieCache 5 phút → giảm 90% DB query session
// - rateLimit per route (sign-in 5/m, sign-up 3/m, send-otp 2/m, forget-otp 3/5m)
// - requireEmailVerification (prod) — xác minh email bằng OTP 6 số (emailOTP plugin)
// - Quên mật khẩu = OTP 6 số (emailOTP forget-password), KHÔNG dùng link
//
// Xác minh email + reset mật khẩu dùng OTP 6 số qua emailOTP plugin
// (overrideDefaultEmailVerification:true → BA gửi OTP thay link). Chi tiết:
// .claude/rules/auth.md §"Email verification + reset bằng OTP".
//
// Plugin thêm dần qua skill (add-oauth, add-2fa, add-passkey).
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import { env } from "@/env";
import { ac, roles } from "@/lib/access-control";
import { sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { bullConnection as redis } from "@/lib/redis";
import { enforcePublicSignupRole } from "@/lib/signup-role-guard";
import { VALIDATION_LIMITS } from "@/lib/validation-limits";

const isProd = env.NODE_ENV === "production";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // env.TRUSTED_ORIGINS đã là string[] (transform ở src/env.ts).
  trustedOrigins: env.TRUSTED_ORIGINS,

  // Secondary storage CHỈ bật production. Dev dùng memory → đơn giản, không
  // phụ thuộc Dragonfly cho auth path lúc develop.
  ...(isProd && {
    secondaryStorage: {
      get: async (k) => await redis.get(`ba:${k}`),
      set: async (k, v, ttl) => {
        if (ttl) await redis.set(`ba:${k}`, v, "EX", ttl);
        else await redis.set(`ba:${k}`, v);
      },
      delete: async (k) => {
        await redis.del(`ba:${k}`);
      },
    },
  }),

  // === Lớp 1 (schema): role KHÔNG nhận input từ client (input:false). ===
  // admin() plugin đã khai role với input:false; ta khai LẠI tường minh ở tầng
  // config để bất biến sống sót cả khi admin plugin bị gỡ/đổi cấu hình sau này.
  // input:false → Better Auth loại role khỏi body sign-up (client không set được);
  // BA 1.6.x còn HARD-REJECT 400 FIELD_NOT_ALLOWED nếu body có role.
  // defaultValue "user" → user tạo ra mà không set role thì là "user" (không null).
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "user",
        required: false,
      },
    },
  },

  // === Lớp 2 (databaseHooks): bảo hiểm KHÔNG phụ thuộc input:false. ===
  // Chạy cho MỌI đường tạo user; CHỈ ép role khi nguồn là public sign-up (untrusted),
  // phân biệt qua ctx.path. admin.createUser (/admin/create-user) + seed (raw insert,
  // không qua hook) GIỮ NGUYÊN role đã authorize server-side.
  // ⚠️ TỐI QUAN TRỌNG: ép role VÔ ĐIỀU KIỆN = PHÁ admin.createUser. Phân biệt ctx.path
  // là BẮT BUỘC (RE-AUDIT ca #3 bắt đúng lỗi này). Hook "user" chạy SAU hook admin
  // plugin (nguồn "user" xếp cuối) → có tiếng nói cuối cùng cho public sign-up.
  databaseHooks: {
    user: {
      create: {
        before: async (userData, ctx) => ({
          data: enforcePublicSignupRole(userData, ctx?.path),
        }),
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    // Ngưỡng ở lib/validation-limits.ts (D-052) — FE đọc CÙNG giá trị qua
    // GET /api/config/validation. KHÔNG hardcode lại ở đây hay bên FE.
    minPasswordLength: VALIDATION_LIMITS.password.minLength,
    maxPasswordLength: VALIDATION_LIMITS.password.maxLength,
    // Pin node:crypto.scrypt (params + format verify giống hệt BA default →
    // backward-compat, KHÔNG reset mật khẩu user). Chống BA bump version đổi
    // params + bundler chọn nhầm biến thể noble pure-JS (block event loop).
    // Trần CPU do middlewares/hash-guard.ts lo — KHÔNG ôm semaphore ở đây.
    password: { hash: hashPassword, verify: verifyPassword },
    // Prod: bắt buộc xác minh email mới sign-in. Dev: skip cho dev velocity.
    requireEmailVerification: isProd,
    autoSignIn: false,
    // KHÔNG dùng sendResetPassword (link) — quên mật khẩu đi qua OTP 6 số
    // (emailOTP forget-password). Một cơ chế duy nhất, nhất quán với verify email.
    // Endpoint core /reset-password (token) vẫn tồn tại nhưng inert (không có
    // sendResetPassword để phát token) — vẫn giữ trong hash-guard vì là scrypt-path.
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // sendVerificationEmail CỐ Ý bỏ trống: emailOTP({ overrideDefaultEmailVerification:
    // true }) override sender này thành OTP 6 số lúc init (xem plugins bên dưới).
    // Giữ sendOnSignUp:true (trigger gửi OTP khi đăng ký) + autoSignInAfterVerification:
    // true (verify OTP xong → tạo session, vào luôn app).
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 ngày
    // cookieCache: session ký HMAC ở cookie → giảm DB query mỗi request.
    // maxAge ngắn (5 phút) để revoke session không bị stale lâu.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    storage: isProd ? "secondary-storage" : "memory",
    // Key tương đối (KHÔNG prefix /api/auth). emailOTP plugin đã tự có rateLimit
    // built-in 60s/3 cho mọi OTP path; customRules dưới đây SIẾT chặt hơn để chống
    // spam gửi OTP (email cost + user-enumeration) — override built-in.
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      // Gửi OTP xác minh email / sign-in OTP: ngặt hơn (1 email / 30s trung bình).
      "/email-otp/send-verification-otp": { window: 60, max: 2 },
      // Nhập OTP xác minh: nới hơn built-in 60/3 (user gõ sai OTP không bị khoá
      // ngay). Guard THẬT chống dò là allowedAttempts:5 (hỏng OTP sau 5 lần sai)
      // + expiresIn:300 + rotate OTP mới phải qua send-otp (60/2). 3 lớp.
      "/email-otp/verify-email": { window: 60, max: 10 },
      // Quên mật khẩu bằng OTP (FE gọi emailOtp.requestPasswordReset → path này;
      // KHÔNG dùng /forget-password/email-otp đã deprecated ở BA 1.6.x).
      "/email-otp/request-password-reset": { window: 300, max: 3 },
      // Đổi mật khẩu bằng OTP: giới hạn số lần thử submit OTP + mật khẩu mới.
      "/email-otp/reset-password": { window: 300, max: 5 },
    },
  },

  advanced: {
    // Cookie browser KHÔNG phân biệt port → 2 dự án cùng localhost đè cookie
    // nhau nếu trùng tên. Prefix theo dự án (env COOKIE_PREFIX, default "app";
    // init-project.mjs set = slug dự án mới).
    cookiePrefix: env.COOKIE_PREFIX,
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
      secure: isProd,
    },
  },

  // Admin plugin: user.role/banned/banReason/banExpires + session.impersonatedBy.
  // Sau khi đổi: bun run db:generate → bun run db:migrate (schema đã thêm tay
  // khớp plugin schema — xem src/db/schema/auth.ts). FE gọi qua adminClient.
  // ⚠️ create-user + set-user-password chạy scrypt → ĐÃ thêm vào HASH_PATHS
  // (middlewares/hash-guard.ts) — bỏ gate là mở đường login self-DoS.
  //
  // emailOTP plugin: xác minh email + quên mật khẩu bằng OTP 6 số.
  // - overrideDefaultEmailVerification:true → BA gửi OTP thay vì link (thay
  //   emailVerification.sendVerificationEmail). KHÔNG bật sendVerificationOnSignUp
  //   (thừa: khi override=true hook signup của plugin bị tắt, trigger đến từ
  //   emailVerification.sendOnSignUp sẵn có → tránh gửi 2 email).
  // - storeOTP:"hashed" → verification.value lưu HASH của OTP (không plaintext).
  // - allowedAttempts:5 + expiresIn:300 + rateLimit send-otp = 3 lớp chống dò
  //   (OTP 6 số = 10^6 tổ hợp, brute-force được nếu không giới hạn).
  // - reset mật khẩu qua OTP chạy scrypt tại /email-otp/reset-password →
  //   ĐÃ thêm vào HASH_PATHS (middlewares/hash-guard.ts). Bỏ gate = login self-DoS.
  // - forget-password privacy-preserving: email không tồn tại vẫn trả success
  //   (BA không lộ user-enumeration) — GIỮ NGUYÊN, đừng thêm nhánh báo lỗi.
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    emailOTP({
      overrideDefaultEmailVerification: true,
      otpLength: VALIDATION_LIMITS.otp.length,
      expiresIn: 300, // 5 phút
      allowedAttempts: 5, // sai quá 5 lần → TOO_MANY_ATTEMPTS (chống brute-force)
      storeOTP: "hashed", // KHÔNG lưu OTP plaintext trong DB
      sendVerificationOTP: async ({ email, otp, type }) => {
        // type: "email-verification" | "forget-password" | "sign-in" | "change-email".
        // Nội dung khác nhau theo type để user hiểu ngữ cảnh mã.
        const copy =
          type === "forget-password"
            ? { subject: "Mã đặt lại mật khẩu", action: "đặt lại mật khẩu" }
            : type === "sign-in"
              ? { subject: "Mã đăng nhập", action: "đăng nhập" }
              : type === "change-email"
                ? { subject: "Mã đổi email", action: "đổi email" }
                : { subject: "Mã xác minh email", action: "xác minh email" };
        // Await như phần còn lại của codebase (sendEmail throw khi lỗi → dev thấy
        // ngay ở Mailhog). Chống user-enumeration/timing đã do BA lo bằng response
        // đồng nhất (forget-password email không tồn tại vẫn trả success).
        await sendEmail({
          to: email,
          subject: copy.subject,
          text: `Mã ${copy.action} của bạn là: ${otp}\n\nMã có hiệu lực trong 5 phút. Đừng chia sẻ mã cho bất kỳ ai.`,
          html: `<p>Mã ${copy.action} của bạn là:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>Mã có hiệu lực trong 5 phút. Đừng chia sẻ mã cho bất kỳ ai.</p>`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
