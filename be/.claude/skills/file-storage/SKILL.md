---
name: file-storage
description: Lưu & phục vụ file trên Cloudflare R2 qua Bun.S3Client cho template BE. Quyết định presigned-URL (client upload thẳng R2) vs proxy (server stream), validate MIME/size TRƯỚC khi ký, key theo scope/owner, serve qua CDN, không load file vào RAM. Dùng khi user gõ "upload file/ảnh", "lưu file", "R2 / S3", "presigned url", "cho user tải lên", "avatar / tài liệu", "serve file", "giới hạn dung lượng upload". Đọc TRƯỚC khi tự dựng SDK S3 hay stream file qua server.
---

# File storage: R2 qua Bun.S3Client

> **One-thing**: quyết định *luồng upload/serve*. Client `Bun.S3Client` đã có ở `src/lib/storage.ts` (`r2`) —
> KHÔNG dựng `@aws-sdk` (nặng, thừa). Thao tác cơ học (route upload/presign) → skill `upload-file`.

## Ground truth (mẫu thật `src/lib/storage.ts`)

```ts
import { S3Client } from "bun";
export const r2 = new S3Client({ accessKeyId, secretAccessKey, bucket, endpoint: `https://${accountId}.r2.cloudflarestorage.com` });
// r2.file(key).presign({ method, expiresIn })  → SYNC (chỉ ký URL local, không network)
// r2.write(key, data)                          → ASYNC (network)
```

⚠️ `storage.ts` là **scaffold documented** (hiện 0 caller trong core) — dùng khi cần, đừng tưởng đã nối dây sẵn.

## Quyết định — presign vs proxy

| | Presigned URL (khuyến nghị) | Proxy qua server |
|---|---|---|
| Luồng | Client xin URL ký → **upload thẳng R2** | Client gửi file lên server → server `r2.write` |
| Ưu | Không tốn băng thông/RAM server; nhanh | Kiểm soát nội dung trước khi lưu |
| Khi dùng | Đa số upload (ảnh, tài liệu) | Cần xử lý/scan/transform trước khi lưu |

Presign 2 chiều: **PUT** (upload) ký ngắn hạn (vd 5 phút); **GET** (download) ký hoặc serve qua CDN public.

## Validate TRƯỚC khi ký / ghi (BẮT BUỘC)

- **MIME allowlist + size** kiểm **trước khi cấp presigned URL** (client-side content-type có thể giả → ràng buộc
  `Content-Type` + `Content-Length` vào URL ký, và/hoặc verify sau upload). Lỗi map: `MIME_NOT_ALLOWED`(400),
  `FILE_TOO_LARGE`(413), `MISSING_FILE`(400) đã có trong `error.ts` ERROR_MAP.
- **Key theo scope/owner**: `uploads/{ownerId}/{ulid}-{safeName}` — đừng để key đoán được/đè chéo. Multi-tenant →
  prefix theo tenant, worker/route re-verify quyền trên key trước khi trả GET.
- **Stream, KHÔNG load RAM**: file lớn → stream (`r2.file(key)`), không `await file.arrayBuffer()` toàn bộ (OOM).

## Serve

- Public asset → CDN (R2 custom domain / Cloudflare) — không proxy mỗi lần qua BE.
- Private → presigned GET ngắn hạn hoặc route kiểm quyền rồi redirect tới URL ký.

## GOTCHAS

- **`presign` là SYNC, `write` là ASYNC** — đừng `await r2.file(key).presign(...)` (không cần) hay quên `await
  r2.write(...)`.
- **Tin `Content-Type` client mù** → user up `.exe` gắn mác `image/png`. Ràng buộc type vào URL ký + kiểm lại.
- **R2 env placeholder**: `R2_*` nhận placeholder lúc boot (chỉ lỗi khi thực sự dùng) — thiếu key thật thì upload
  fail runtime, không phải boot. Đặt key thật khi bật tính năng (CLAUDE.md §7).
- **Key đoán được / không scope** → IDOR (đọc file người khác). Luôn ULID + kiểm quyền theo owner.

## Cross-reference

skill `upload-file` (route presign/proxy cơ học) · `hono-api-patterns` (validate zv, error envelope) ·
`postgres-drizzle-data` (lưu metadata file) · `cluster-stateless` (key/scope, không state RAM).
