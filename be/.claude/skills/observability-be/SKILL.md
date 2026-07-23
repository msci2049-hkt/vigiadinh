---
name: observability-be
description: Quan sát BE production đúng cách — Sentry (init dòng đầu, sample, không PII), pino structured log có redact + request-id xuyên suốt, và cách THÊM /metrics Prometheus + OTel traceparent nối FE↔BE↔BullMQ khi cần (template chưa có sẵn 2 cái sau). Dùng khi user gõ "thêm logging / monitoring", "Sentry BE", "request id / correlation id", "structured log", "metrics / Prometheus", "OpenTelemetry / trace", "log bị lộ mật khẩu", "đo latency", "nối trace FE sang BE". Đọc TRƯỚC khi tự thêm console.log hay dựng logger/monitoring mới.
---

# Observability BE: Sentry + pino + request-id (+OTel khi cần)

> **One-thing**: quyết định *log/trace/metric ở đâu, cái gì đã có*. Setup Sentry/uptime cơ học → skill
> `setup-monitoring`. Đừng `console.log` — dùng `logger`.

## Đã có sẵn (dùng, đừng làm lại)

- **Sentry** (`src/lib/sentry.ts`): `import "@/lib/sentry"` là **DÒNG ĐẦU** `index.ts`/`workers/index.ts` (init
  trước mọi module). `tracesSampleRate` 0.1 prod / 1.0 dev, `sendDefaultPii:false`. Capture CHỈ ở nhánh Unknown
  của `errorHandler` (HTTPException/Zod = noise). `captureException` trả `eventId` → nhét vào response 500.
- **pino logger** (`src/lib/logger.ts`): JSON prod / pretty dev, **redact sẵn** `password/token/secret/authorization/
  cookie/...` (cả nested `*.X`). Log qua `logger.info(obj, "msg")` — object trước, message sau.
- **request-id** (`src/app.ts`): middleware set `c.set("requestId", id)` (ulid hoặc `x-request-id` client, có
  cap độ dài chống inject 10MB) + trả header `x-request-id`. `errorHandler` gắn `reqId` vào log.

## Quyết định — log cái gì, mức nào

- Structured: `logger.info({ userId, orderId }, "order.created")` — field riêng, KHÔNG nội suy chuỗi (query được).
- **KHÔNG log PII/secret/OTP/nội dung email** — redact chỉ bắt key đã liệt kê; nội dung tự do vẫn lọt. Tự giác.
- Mức: `error` (cần người xem) · `warn` (bất thường tự phục hồi) · `info` (mốc nghiệp vụ) · `debug` (chỉ dev).
- Bind `requestId`/`userId` vào log của 1 request để trace được xuyên middleware→service→job.

## THÊM khi cần (template CHƯA có)

- **/metrics Prometheus**: chưa có endpoint. Thêm → expose counter/histogram (latency per-route, queue depth),
  scrape bằng Prometheus. Latency budget per-stage (auth/db/handler) để biết khâu nào chậm.
- **OTel distributed trace**: chưa nối. FE đã gửi `sentry-trace` + `baggage` (BE cors `allowHeaders` cho qua) →
  Sentry nối FE↔BE. Muốn OTel đầy đủ FE↔BE↔worker → thêm OTel SDK + `traceparent`, và **BullMQOtel** để job có
  trace/metrics nối chung (xem `bullmq-jobs`).
- Uptime (UptimeRobot/Better Stack) ping `/health` + `/ready` — skill `setup-monitoring`.

## GOTCHAS

- **Sentry init KHÔNG ở dòng đầu** → miss exception lúc boot + instrument thiếu module. `import "@/lib/sentry"`
  phải TRƯỚC mọi import khác (side-effect).
- **Không có DSN → Sentry no-op** (dev/test): `captureException` trả `undefined`, không throw — code gọi vẫn safe.
- **`console.log` bỏ qua redact** → dễ leak + không structured. Luôn `logger`.
- **Capture mọi lỗi vào Sentry** = noise + cháy quota → chỉ Unknown/500 (đã đúng trong `errorHandler`, đừng thêm
  capture ở middleware).
- **x-request-id client không cap độ dài** → bind log 10MB. `app.ts` đã cap — giữ khi sửa.
- **PG18** `pg_stat_all_tables.total_vacuum_time` soi autovacuum (khi nâng PG18 — template PG16, xem `scaling-playbook`).

## Cross-reference

skill `setup-monitoring` · `hono-api-patterns` (errorHandler capture) · `bullmq-jobs` (BullMQOtel) ·
`graceful-shutdown-readiness` (/health, /ready) · `sentry-frontend` (FE, nối trace) · `scaling-playbook` (đo p95).
