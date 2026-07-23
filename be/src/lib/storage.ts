// WHY: Cloudflare R2 = S3-compatible API → dùng `Bun.S3Client` built-in
// (KHÔNG `@aws-sdk` — bundle nặng, không cần).
//
// `r2.file(key).presign(...)` là SYNC (chỉ ký URL local). `r2.write(key, ...)`
// là ASYNC (network). Đọc .claude/skills/upload-file để biết pattern presign
// (client upload trực tiếp R2) vs proxy (server stream qua).
import { S3Client } from "bun";
import { env } from "@/env";

export const r2 = new S3Client({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucket: env.R2_BUCKET,
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});
