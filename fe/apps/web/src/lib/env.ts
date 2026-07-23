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
  return result.data;
}

export const env = loadEnv();
