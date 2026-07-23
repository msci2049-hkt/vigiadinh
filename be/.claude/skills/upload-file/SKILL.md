# SKILL: Upload file (Bun.S3Client → R2)

## Dùng khi nào

- User upload avatar, ảnh sản phẩm, document, hoá đơn.
- File nhỏ (< 10MB) → server-proxy (validate + resize + strip EXIF).
- File lớn (> 10MB) → presigned URL, client upload thẳng lên R2.
- **KHÔNG** dùng `@aws-sdk/client-s3` — Bun built-in S3Client từ v1.1.43.

---

## Thứ tự làm

```
1. Setup Bun.S3Client 1 lần trong src/lib/storage.ts.

2. Bảng `files` trong src/db/schema/files.ts:
   id, key, ownerId, mime, sizeBytes, status.

3. src/services/uploads.ts với 3 hàm:
   - presignUpload (client upload trực tiếp)
   - proxyUploadImage (server resize)
   - signedDownloadUrl (signed GET)

4. src/routes/uploads.ts mount qua skill new-route.

5. Curl test 3 case.
```

---

## File tạo ở đâu

```
src/lib/storage.ts                  ← Bun.S3Client trỏ R2
src/db/schema/files.ts              ← bảng files
src/services/uploads.ts             ← logic
src/modules/upload/routes.ts        ← HTTP route
```

---

## Code mẫu

### 1. `src/lib/storage.ts`

```ts
/**
 * Bun.S3Client built-in từ v1.1.43 — KHÔNG cần @aws-sdk.
 *
 * R2 S3-compatible: endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * Bun docs: "all methods that don't involve network requests are fully
 * synchronous" → presign() KHÔNG hit R2, không cần await.
 */
import { S3Client } from "bun";
import { env } from "@/env";

export const r2 = new S3Client({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucket: env.R2_BUCKET,
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});
```

### 2. `src/db/schema/files.ts`

```ts
/**
 * Bảng files — metadata. Object thật lưu R2 theo `key`.
 * - status: pending (presign issued) → ready (uploaded) → scanned/infected.
 */
import { pgTable, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const files = pgTable(
  "files",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    key: varchar("key", { length: 500 }).notNull().unique(),
    ownerId: varchar("owner_id", { length: 26 }).notNull(),
    mime: varchar("mime", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: varchar("status", { length: 16 }).notNull(), // pending | ready | scanned | infected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("files_owner_idx").on(t.ownerId),
  }),
);

export type FileRow = typeof files.$inferSelect;
```

### 3. `src/services/uploads.ts`

```ts
/**
 * 2 path upload:
 *  - presignUpload: client PUT trực tiếp R2 (file lớn).
 *  - proxyUploadImage: server resize + strip EXIF (ảnh nhỏ).
 *
 * sharp .rotate() PHẢI gọi TRƯỚC .resize() để apply EXIF orientation,
 * không thì ảnh chân dung điện thoại bị xoay ngang.
 * (sharp KHÔNG có sẵn trong package.json — cài khi dùng skill này: bun add sharp)
 */
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import { files } from "@/db/schema/files";
import { r2 } from "@/lib/storage";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function presignUpload(args: {
  ownerId: string; mime: string; sizeHint: number;
}): Promise<{ id: string; key: string; url: string }> {
  if (!ALLOWED_MIME.has(args.mime)) throw new Error("MIME_NOT_ALLOWED");
  if (args.sizeHint > MAX_BYTES) throw new Error("FILE_TOO_LARGE");

  const [row] = await db.insert(files).values({
    key: `tmp_${Date.now()}`, ownerId: args.ownerId,
    mime: args.mime, sizeBytes: args.sizeHint, status: "pending",
  }).returning({ id: files.id });

  const key = `uploads/${args.ownerId}/${row.id}`;
  await db.update(files).set({ key }).where(eq(files.id, row.id));

  // presign() là SYNC — không await. Pin `type` để client không gửi MIME khác.
  const url = r2.presign(key, { method: "PUT", expiresIn: 300, type: args.mime });
  return { id: row.id, key, url };
}

export async function proxyUploadImage(args: {
  ownerId: string; buffer: Buffer; mime: string;
}): Promise<{ id: string; key: string }> {
  if (!ALLOWED_MIME.has(args.mime)) throw new Error("MIME_NOT_ALLOWED");
  if (args.buffer.byteLength > MAX_BYTES) throw new Error("FILE_TOO_LARGE");

  // .rotate() TRƯỚC .resize() để apply EXIF.
  const processed = await sharp(args.buffer)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .toFormat("webp", { quality: 85 })
    .toBuffer();

  const [row] = await db.insert(files).values({
    key: `tmp_${Date.now()}`, ownerId: args.ownerId,
    mime: "image/webp", sizeBytes: processed.byteLength, status: "ready",
  }).returning({ id: files.id });

  const key = `uploads/${args.ownerId}/${row.id}.webp`;
  await db.update(files).set({ key }).where(eq(files.id, row.id));
  await r2.write(key, processed, { type: "image/webp" }); // async (network)
  return { id: row.id, key };
}

export async function signedDownloadUrl(fileId: string): Promise<string> {
  const [row] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!row) throw new Error("FILE_NOT_FOUND");
  return r2.presign(row.key, { method: "GET", expiresIn: 3600 });
}
```

### 4. `src/modules/upload/routes.ts`

```ts
/**
 * Upload routes — auth bắt buộc cho mọi endpoint.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { bodyLimit } from "hono/body-limit";
import { requireAuth } from "@/middlewares/auth";
// WHY `zv` thay `zValidator`: BUG-001 (shape lệch onError).
import { zv } from "@/middlewares/validator";
import * as uploadService from "@/services/uploads";

const presignDto = z.object({
  mime: z.string().min(1).max(100),
  sizeHint: z.number().int().positive().max(10 * 1024 * 1024),
});

export const uploadRoutes = new Hono()
  .use("*", requireAuth)
  .post("/presign", zv("json", presignDto), async (c) => {
    const userId = c.get("user")!.id;
    const input = c.req.valid("json");
    return c.json({ data: await uploadService.presignUpload({ ownerId: userId, ...input }) }, 201);
  })
  .post("/",
    bodyLimit({ maxSize: 12 * 1024 * 1024 }), // 12MB để dư cho multipart overhead
    async (c) => {
      const fd = await c.req.parseBody();
      const file = fd["file"];
      if (!(file instanceof File)) {
        throw new HTTPException(400, { message: "MISSING_FILE" });
      }
      return c.json({
        data: await uploadService.proxyUploadImage({
          ownerId: c.get("user")!.id,
          buffer: Buffer.from(await file.arrayBuffer()),
          mime: file.type,
        }),
      }, 201);
    })
  .get("/:id/url", async (c) => {
    const url = await uploadService.signedDownloadUrl(c.req.param("id"));
    return c.json({ url });
  });
```

---

## Curl test

```bash
# 1. Presign URL
curl -i -X POST http://localhost:3000/api/uploads/presign \
  -b cookie.txt -H "Content-Type: application/json" \
  -d '{"mime":"image/png","sizeHint":1024}'
# → 201 { data: { id, key, url } }

# 2. Client PUT trực tiếp R2
curl -i -X PUT --upload-file ./local.png "<url-từ-bước-1>" \
  -H "Content-Type: image/png"
# → 200

# 3. Proxy upload (server resize)
curl -i -X POST http://localhost:3000/api/uploads \
  -b cookie.txt -F "file=@./photo.jpg"
# → 201 { data: { id, key } }, R2 nhận file .webp

# 4. Signed download URL
curl -i http://localhost:3000/api/uploads/<id>/url -b cookie.txt
# → 200 { url: "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }
# Mở URL trên browser → file load được.
```

---

## Checklist cuối

- [ ] `Bun.S3Client` (KHÔNG `@aws-sdk`).
- [ ] Endpoint R2: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- [ ] `presign()` KHÔNG await (sync).
- [ ] `r2.write()` CÓ await (network).
- [ ] sharp `.rotate()` TRƯỚC `.resize()`.
- [ ] MIME whitelist + size limit ở mọi path.
- [ ] `bodyLimit` cho proxy upload (Hono default 100KB).
- [ ] `presign` type binding để client không gửi MIME khác.
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| Presigned PUT trả 403 | Client `Content-Type` không match `type` lúc presign | Đảm bảo MIME identical 2 phía. |
| Bun báo `S3Client requires bucket` | Thiếu env hoặc option | Set `bucket` explicit trong constructor. |
| `await r2.presign(...)` lỗi type | Method sync | Bỏ `await`. |
| EXIF orientation sai (ảnh nằm ngang) | `.rotate()` sau `.resize()` | Luôn `.rotate()` trước `.resize()`. |
| File 11MB lỗi 413 | Hono `bodyLimit` mặc định | Thêm `bodyLimit({ maxSize: ... })`. |
| Presigned URL hết hạn sớm | `expiresIn` mặc định lớn nhưng client config 60s | `expiresIn: 300` upload, `3600` download. |
| MIME smuggle (client gửi exe nói là png) | Chỉ check header | Validate magic bytes server-side (vd: file-type lib). |
| Download URL leak | `signedDownloadUrl` không check ownership | Thêm `assertOwnership` trước khi presign. |
| R2 CORS error từ browser | Bucket chưa setup CORS | Cloudflare dashboard → R2 → bucket → CORS rules. |
| `import { S3Client } from "bun"` không có type | Bun types chưa cài | `bun add -d @types/bun`. |
