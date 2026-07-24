// WHY: Nguồn sự thật DUY NHẤT cho schema env. 3 nơi import chung từ đây —
// KHÔNG duplicate schema (drift schema ↔ checker chính là lỗi một dự án trước từng dính):
//   1. src/env.ts                    — validate lúc boot (fail-fast, report rõ).
//   2. scripts/env-check.ts          — kiểm .env/.env.production TRƯỚC khi boot/deploy.
//   3. scripts/check-env-parity.ts   — chống drift key giữa schema ↔ *.example.
// File này CHỈ được import zod — phải load được mà KHÔNG mở DB/Redis/app.
import { z } from "zod";

export const envShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  REDIS_URL: z.url(),

  // === Hash concurrency guard (chống login self-DoS — xem middlewares/hash-guard.ts) ===
  // Trần CPU hashing TOÀN CỤC mỗi process. Trần thực BOX-WIDE =
  // WEB_INSTANCES × HASH_MAX_CONCURRENT — giữ ≤ ~2×core (xem README).
  HASH_MAX_CONCURRENT: z.coerce.number().int().positive().default(2),
  HASH_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  HASH_MAX_QUEUE: z.coerce.number().int().nonnegative().default(64),

  // === Cluster + pool budget (src/lib/pool-budget.ts, docs/SCALE-RUNBOOK.md) ===
  // Số web process cluster.ts spawn (reusePort). TƯỜNG MINH — KHÔNG nproc:
  // trong container nproc = core HOST (sai khi giới hạn --cpus). Dev = 1.
  WEB_INSTANCES: z.coerce.number().int().positive().default(1),
  // max_connections THẬT của Postgres (compose default 100). Pool-budget refuse
  // boot nếu (WEB_INSTANCES+1)×DB_POOL_MAX > 80%×giá trị này.
  PG_MAX_CONNECTIONS: z.coerce.number().int().positive().default(100),
  // Core THỰC container được cấp (--cpus). Trống → navigator.hardwareConcurrency
  // (báo core HOST trong container → set tay ở prod cho cảnh báo hash chuẩn).
  CPU_CORES: z.coerce.number().int().positive().optional(),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET phải ≥ 32 ký tự"),
  BETTER_AUTH_URL: z.url(),
  // Prefix tên cookie Better Auth. Cookie browser KHÔNG phân biệt port → hai dự án
  // cùng chạy localhost sẽ ĐÈ cookie session của nhau nếu trùng tên. Mỗi dự án một
  // prefix riêng (init-project.mjs tự set = slug dự án). Đổi prefix = mọi session
  // hiện có bị "logout" (cookie cũ không được đọc nữa) — vô hại ở dev.
  COOKIE_PREFIX: z.string().min(1).default("app"),
  // CSV "https://a.com,https://b.com" → array. Transform tại đây để type
  // `env.TRUSTED_ORIGINS: string[]` mọi nơi dùng — tránh split lặp lại ở
  // app.ts (CORS), auth.ts (trustedOrigins), v.v.
  TRUSTED_ORIGINS: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  // SMTP cho dev (Mailhog) — production dùng Resend qua RESEND_API_KEY ở trên.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),

  // Optional: production khuyến nghị bật, dev/test có thể bỏ.
  SENTRY_DSN: z.url().optional(),

  // === Stellar / SEP-45 (PHA 2.3 — đăng nhập bằng ví contract) ===
  STELLAR_RPC_URL: z.url().default("https://soroban-testnet.stellar.org"),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1).default("Test SDF Network ; September 2015"),
  // Contract SEP-45 (web_auth_verify) đã deploy — contracts/web-auth. Chưa set
  // → route sep45 trả 503 SEP45_NOT_CONFIGURED (boot vẫn sống, các module khác chạy).
  SEP45_WEB_AUTH_CONTRACT_ID: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/, "phải là contract ID (C...)")
    .optional(),
  // SIGNING_KEY của server (S...) — ký entry phía server trong challenge.
  // Tài khoản G tương ứng PHẢI tồn tại trên network (friendbot ở testnet).
  SEP45_SIGNING_KEY: z
    .string()
    .regex(/^S[A-Z2-7]{55}$/, "phải là secret key (S...)")
    .optional(),
  // home_domain = domain FE (nơi host stellar.toml sau này); web_auth_domain = domain BE.
  SEP45_HOME_DOMAIN: z.string().min(1).default("localhost:5173"),
  SEP45_WEB_AUTH_DOMAIN: z.string().min(1).default("localhost:3000"),
  // TTL challenge/nonce (A4: 2–5 phút) + TTL JWT phiên ví.
  SEP45_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SEP45_JWT_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  // === Webhook secrets (optional) ===
  // Chỉ điền cho provider thực sự dùng. verify.ts throw rõ ràng nếu code
  // gọi verifyX() mà env tương ứng chưa set — không silent return false.
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SEPAY_API_KEY: z.string().optional(),
} as const;

export const envSchema = z.object(envShape);

export type EnvValues = z.infer<typeof envSchema>;

/** "" → undefined để Zod báo "THIẾU" thay vì "expected string, got ''"
 * (giữ hành vi `emptyStringAsUndefined` của @t3-oss/env-core trước đây). */
export function normalizeRawEnv(
  raw: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

/** Tập biến BẮT BUỘC phải set (không default, không optional). Thiếu 1 biến
 * = boot chết → pm2/docker crash-loop. Đây chính là danh sách mà dự án trước không
 * biết mà gãy khi flip NODE_ENV=production. */
export function requiredEnvKeys(): string[] {
  return Object.entries(envShape)
    .filter(([, schema]) => !schema.safeParse(undefined).success)
    .map(([key]) => key);
}

export type EnvIssueLine = { key: string; reason: string };

/** Zod issues → dòng "TÊN_BIẾN — lý do" đọc được trong 5 giây (không dump JSON).
 * 1 dòng / biến — đủ để biết sửa gì, không ngập log. */
export function formatEnvIssues(
  issues: readonly z.core.$ZodIssue[],
  raw: Record<string, string | undefined>,
): EnvIssueLine[] {
  const byKey = new Map<string, string>();
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "(root)");
    if (byKey.has(key)) continue;
    const reason =
      raw[key] === undefined ? "THIẾU — biến chưa được set (hoặc để rỗng)" : issue.message;
    byKey.set(key, reason);
  }
  return [...byKey.entries()].map(([key, reason]) => ({ key, reason }));
}
