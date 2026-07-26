import { z } from "zod";

/**
 * All env vars are prefixed `VITE_` and validated at startup. Importing `env`
 * anywhere guarantees the values exist and are well-typed (no `import.meta.env`
 * sprinkled across the app, no hardcoded URLs — see .claude/rules).
 */
const EnvSchema = z.object({
  VITE_API_URL: z.url({
    error: "VITE_API_URL must be a valid URL (e.g. http://localhost:3000)",
  }),
  VITE_APP_NAME: z.string().min(1).default("Mau Demo FE"),
  VITE_ENABLE_DEVTOOLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Sentry DSN — optional: thiếu/để trống = Sentry TẮT (src/instrument.ts chỉ
  // init khi PROD + có DSN). Chuỗi rỗng coi như chưa set.
  VITE_SENTRY_DSN: z
    .url({ error: "VITE_SENTRY_DSN must be a URL (or leave it unset)" })
    .optional()
    .or(z.literal("").transform(() => undefined)),

  // === Stellar / ví passkey (PHA 2.3) — mặc định testnet, đổi mainnet TƯỜNG MINH ===
  VITE_STELLAR_RPC_URL: z.url().default("https://soroban-testnet.stellar.org"),
  VITE_STELLAR_NETWORK_PASSPHRASE: z.string().min(1).default("Test SDF Network ; September 2015"),
  // WASM hash smart account + verifier đã deploy (contracts/). Trống = chưa nối
  // chain (features/wallet/lib/kit.ts throw lỗi RÕ khi bị dùng, app vẫn boot).
  VITE_ACCOUNT_WASM_HASH: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "phải là wasm hash hex 64 ký tự")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  VITE_WEBAUTHN_VERIFIER_ADDRESS: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/, "phải là contract ID (C...)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // rpId passkey — QUYẾT ĐỊNH KHÔNG ĐẢO LẠI ĐƯỢC.
  //
  // Authenticator băm SHA-256 rpId và nhúng vào credential NGAY LÚC TẠO. Không có
  // API nào sửa được sau đó, không có đường migrate. Đổi rpId = MỌI passkey chết =
  // người dùng mất đường vào ví, chỉ còn cách đi qua guardian recovery.
  //
  // Vì sao KHÔNG dùng apex `mscilabs.com`: rpId là scope — passkey điều khiển tiền
  // sẽ gọi được từ BẤT KỲ subdomain nào của apex. Một subdomain khác dính XSS là
  // gọi được passkey ví. Hẹp lại `familyhaven.mscilabs.com` thì TRÌNH DUYỆT tự từ
  // chối, không phải chờ server kiểm.
  //
  // Default "localhost" CHỈ cho dev; production fail-closed ở loadEnv() bên dưới.
  VITE_PASSKEY_RP_ID: z.string().min(1).default("localhost"),
  // Registry khôi phục (v2) — cắm vào ví NGAY trong tx deploy (constructor).
  // Trống = ví deploy ra KHÔNG khôi phục được, nên màn tạo ví chặn trước khi
  // tạo passkey thay vì đẻ ra ví cụt (features/wallet/api/create-wallet.ts).
  VITE_RECOVERY_REGISTRY_ADDRESS: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/, "phải là contract ID (C...)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Cooldown (giây) sau khi khôi phục xoay khoá: ví chối MỌI chữ ký trong cửa
  // sổ này để kẻ chiếm được đợt khôi phục không rút ngay. Mặc định 24h.
  VITE_RECOVERY_COOLDOWN_SECS: z.coerce.number().int().positive().default(86400),
  // SAC của tài sản gốc (XLM). FE PHẢI tự biết địa chỉ này để đối chiếu entry
  // TRƯỚC khi ký (lib/auth-entry-guard.ts): nếu lấy từ phản hồi backend thì
  // backend bị chiếm chỉ việc trả contract khác — so bản sao với bản gốc của
  // chính kẻ tấn công thì luôn khớp.
  VITE_SAC_NATIVE: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/, "phải là contract ID (C...)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(import.meta.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment variables:\n${details}\n\nCopy .env.example to .env and fix the values.`,
    );
  }

  // FAIL-CLOSED cho build production: rpId rơi về "localhost" là hỏng KHÔNG THỂ
  // SỬA. Vite nướng env lúc BUILD, nên nếu không chặn ở đây thì bản production
  // vẫn build xanh, deploy xanh, và mỗi passkey người dùng tạo ra đều gắn với
  // "localhost" — chết vĩnh viễn trên domain thật, phát hiện ra thì đã muộn.
  // Thà vỡ lúc build còn hơn đẻ ra credential không dùng được.
  if (import.meta.env.PROD && result.data.VITE_PASSKEY_RP_ID === "localhost") {
    throw new Error(
      '❌ VITE_PASSKEY_RP_ID vẫn là "localhost" trong build PRODUCTION.\n' +
        "   rpId nhúng vĩnh viễn vào passkey lúc tạo — không sửa được, không migrate được.\n" +
        "   Đặt VITE_PASSKEY_RP_ID=familyhaven.mscilabs.com rồi build lại.",
    );
  }

  return result.data;
}

export const env = loadEnv();
