// WHY: Validate env tại boot — fail-fast, và IN BÁO CÁO ĐỌC ĐƯỢC ra stderr.
// Sự cố gốc (dự án trước): flip NODE_ENV=production thiếu biến → process chết với
// Zod stacktrace chôn trong pm2 logs → crash-loop mù, phải rollback. Giờ:
//   - Dòng ĐẦU stderr liệt kê TÊN BIẾN + LÝ DO (đọc pm2/docker logs 5 giây là biết).
//   - Kiểm TRƯỚC khi boot/deploy: `bun run env:check [--env-file <file>]`.
// Schema sống ở src/env.schema.ts — import chung với scripts/env-check.ts,
// KHÔNG duplicate. Mọi nơi trong code import `env` từ đây thay vì process.env.
import { envSchema, formatEnvIssues, normalizeRawEnv } from "@/env.schema";

const raw = normalizeRawEnv(process.env);
const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  const lines = formatEnvIssues(parsed.error.issues, raw);
  console.error(`❌ ENV KHÔNG HỢP LỆ — chặn boot. ${lines.length} biến lỗi:`);
  for (const { key, reason } of lines) {
    console.error(`   • ${key} — ${reason}`);
  }
  console.error("→ Kiểm trước khi chạy: bun run env:check [--env-file <file>]");
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
