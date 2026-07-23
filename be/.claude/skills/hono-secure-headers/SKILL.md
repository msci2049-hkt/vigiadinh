---
name: hono-secure-headers
description: Gắn secureHeaders() + csrf() cho Hono API đúng mount order, CSP khoá chặt cho API JSON-only, không phá Better Auth/CORS/preflight. Dùng khi user nói "thêm security headers", "HSTS", "CSP cho API", "chống clickjacking", "csrf hono", "secure headers", hoặc khi preflight OPTIONS bỗng 403 / curl POST bỗng 403 sau khi thêm middleware bảo mật. Chứa gotchas thật: cors PHẢI đứng trước csrf (OPTIONS không nằm trong safe-list của csrf), csrf chặn cả request THIẾU content-type (vá GHSA-2234-fmw7-43wr) nên curl không header sẽ 403, JSON được csrf bỏ qua có chủ đích, CSP default-src 'none' sẽ giết route HTML nếu sau này thêm.
---

# secureHeaders + csrf cho Hono API

## Mount order (BẤT BIẾN — sai là vỡ auth hoặc vỡ preflight)

```
CORS → secureHeaders → csrf(/api/*) → requestId/logger → hashGuard
→ auth.handler → session → routes → onError
```

- **cors TRƯỚC csrf**: cors() trả preflight OPTIONS 204 ngay, KHÔNG gọi next().
  csrf coi safe-method chỉ là GET|HEAD — **OPTIONS không nằm trong safe-list**
  → csrf đứng trước là 403 preflight cross-origin, FE chết CORS toàn tập.
- secureHeaders sau cors, trước mọi route: mọi response (kể cả lỗi) đều có
  header; tự xoá `x-powered-by` (removePoweredBy mặc định true).

## Config chuẩn cho API JSON-only (đã gắn ở src/app.ts)

```ts
secureHeaders({
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  xFrameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
  crossOriginResourcePolicy: "same-site",
})
csrf({ origin: env.TRUSTED_ORIGINS })  // trên /api/*
```
Mặc định Hono đã bật nosniff/COOP/xXssProtection:0... — chỉ override cái cần.
CSP không set mặc định — PHẢI truyền object mới có header (không nhận `true`).

## csrf() thực sự chặn gì (đọc kỹ kẻo tưởng hỏng)

Chặn khi ĐỦ: method không phải GET/HEAD + content-type thuộc
form-urlencoded/multipart/text-plain **hoặc THIẾU content-type** (mặc định
coi là text/plain — vá bypass GHSA-2234-fmw7-43wr) + Origin ∉ danh sách +
Sec-Fetch-Site không phải same-origin. Pass MỘT trong hai header là qua.

- **JSON đi qua csrf** — có chủ đích: cross-site không gửi được JSON kèm
  cookie nhờ CORS + sameSite; csrf lo lớp form-POST (form cross-site gửi
  được cookie mà không cần CORS).
- **curl POST không Content-Type → 403** — không phải bug: thêm
  `-H "Content-Type: application/json"` hoặc `-H "Origin: <trusted>"`.
- `origin: string[]` match CHÍNH XÁC scheme+host+port, không wildcard,
  không trailing slash.
- Proxy lột cả Origin lẫn Sec-Fetch-Site → request form bị chặn oan —
  môi trường đó phải chuyển CSRF token-based.

## Gotchas

- Route HTML sau này (docs Scalar, email preview): CSP `default-src 'none'`
  giết trang đó. Mở CSP RIÊNG cho route đó (`app.use("/docs/*",
  secureHeaders({contentSecurityPolicy: {...script/style...}}))` mount TRƯỚC
  bản global? Không — Hono chạy theo thứ tự đăng ký, response-phase chạy
  ngược: đăng ký rule riêng cho path đó TRƯỚC rule `*` để nó thắng), đừng
  nới policy toàn cục.
- Better Auth có trustedOrigins CSRF riêng cho /api/auth/* — hono/csrf phủ
  toàn /api/* là lớp bổ sung, không thay thế.
- Verify bằng `app.request` (không cần server): GET /health có đủ header;
  OPTIONS preflight 204; form-POST origin lạ 403; POST thiếu content-type
  403; JSON POST đi tới auth (401 chứ KHÔNG 403); form-POST origin tin cậy
  401. Sáu case này là bộ PoC chuẩn.
