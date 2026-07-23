---
name: email-delivery
description: Gửi email đúng cách trong template BE — dev/test qua Mailhog (SMTP local), production qua Resend, dùng chung helper sendEmail. Quyết định: KHÔNG await gửi email trong request (đẩy job), rate-limit gửi, xử lý bounce/complaint, cấu hình SPF/DKIM/DMARC để không vào spam. Dùng khi user gõ "gửi email", "email xác minh / reset", "Resend", "Mailhog", "email vào spam", "SPF DKIM DMARC", "email chậm làm treo request", "template email". Đọc TRƯỚC khi gọi Resend trực tiếp hay await gửi email trong handler.
---

# Email delivery: Mailhog dev, Resend prod

> **One-thing**: quyết định *luồng gửi*. Helper `sendEmail` đã có (`src/lib/email.ts`) — dùng chung, đừng gọi
> Resend/nodemailer thẳng. Tạo template cụ thể → skill `new-email`.

## Ground truth (mẫu thật `src/lib/email.ts`)

```ts
sendEmail({ to, subject, text, html? }): Promise<void>
// dev/test → nodemailer SMTP Mailhog (host localhost, port 1025; UI http://localhost:8025) — KHÔNG gửi thật
// production → Resend (dynamic import), throw nếu result.error
```

Dev đọc email tại **Mailhog UI http://localhost:8025** (đã có trong `docker compose up -d`). Better Auth
emailOTP `sendVerificationOTP` gọi qua `sendEmail` (rule auth.md).

## Quyết định — KHÔNG await gửi trong request (đa số)

Gửi email trong luồng HTTP làm: (1) tăng latency request theo mạng Resend; (2) **timing attack** (thời gian
phản hồi khác nhau giữa email tồn tại/không → lộ user-enumeration). → đẩy **BullMQ job** (`bullmq-jobs` + `new-job`),
request trả ngay.

- Ngoại lệ có chủ đích: OTP/verification Better Auth gọi trong callback auth — chấp nhận vì là core auth flow; vẫn
  giữ `request-password-reset` privacy-preserving (email không tồn tại vẫn trả `success` — rule auth.md).

## Rate-limit gửi

Endpoint gửi OTP đã rate-limit (send-verification-otp 2/phút, request-password-reset 3/5phút — rule auth.md). Email
nghiệp vụ khác (mời, thông báo) → rate-limit theo user + theo loại để tránh spam/đốt quota Resend.

## Deliverability (không vào spam) — việc TAY hạ tầng

- **SPF** (TXT cho domain gửi), **DKIM** (Resend cấp record), **DMARC** (policy) — thiếu = vào spam/junk. Đây là
  cấu hình DNS, KHÔNG code — ghi vào checklist deploy.
- `EMAIL_FROM` phải là domain đã verify ở Resend (không dùng gmail.com free).

## Bounce / complaint

- Resend webhook `email.bounced` / `email.complained` → cập nhật trạng thái địa chỉ (suppress list), ngừng gửi tới
  hard-bounce. Nhận webhook: skill `webhook-receiver` (HMAC + dedup + ack<1s).

## GOTCHAS

- **await Resend trong request** → latency + timing-attack user-enumeration → job.
- **Nuốt `result.error`**: `sendEmail` prod **throw** khi Resend lỗi — đừng catch-and-ignore (mất email âm thầm).
  Trong job: TRANSIENT (Resend 5xx/network) → throw để retry; PERMANENT (email sai format) → discard.
- **Log email body/OTP** = leak PII/secret. Logger đã redact `token/secret/...` nhưng KHÔNG log nội dung email/OTP.
- **Nâng `nodemailer` v9** (repo `^9.0.3`) — API `createTransport` giữ nguyên; chỉ dùng ở dev.
- **Dev không thấy email** → kiểm Mailhog chạy (`docker compose up -d`) + `SMTP_HOST/PORT` đúng 1025.

## Cross-reference

skill `new-email` (template React Email + Resend) · `webhook-receiver` (bounce/complaint) · `bullmq-jobs` (gửi nền) ·
`.claude/rules/auth.md` (OTP email) · `observability-be` (không log PII).
