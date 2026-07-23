# Bảng lỗi đã gặp & cách sửa

> **Gặp bug → ghi vào đây ngay.** Trước khi code feature mới, scan file này xem có chạm pattern cũ không.

Format mỗi entry:
- **Triệu chứng**: hiện tượng nhìn thấy
- **Nguyên nhân**: vì sao xảy ra
- **Cách sửa**: làm gì để fix
- **File/dòng**: nơi đã fix (commit hash càng tốt)
- **Ngày**: YYYY-MM-DD

---

## Bug đã gặp

(Chưa có bug FamilyWallet nào. BUG-001…014 của lớp demo carbon template đã xóa khi bootstrap —
bài học đã đúc vào bảng pattern dưới; chi tiết cũ nằm trong lịch sử git.)

---

## Các pattern thường gây bug (cheatsheet để tránh)

| Pattern | Hậu quả | Cách tránh |
|---|---|---|
| BullMQ Queue tên không `{}` | Throughput thấp trên Dragonfly | Luôn dùng `{queue-name}` + Dragonfly flag `--cluster_mode=emulated --lock_on_hashtags`. |
| ioredis dùng chung Bull + rate-limit | `maxRetriesPerRequest must be null` hoặc rate-limit hang | Tách 2 connection trong `src/lib/redis.ts`. |
| Better Auth handler mount SAU session middleware | Sign-in 404/401 | Mount `auth.handler` theo đúng order thật trong `src/app.ts` (xem `.claude/rules/auth.md`). |
| HMAC verify dùng `===` | Có thể bị timing attack | Luôn `crypto.timingSafeEqual` với Buffer cùng length. |
| Body parse trước HMAC verify | Verify luôn fail | `captureRawBody` middleware chạy trước parser; dùng `c.req.raw.clone().text()`. |
| Cron không có timezone | Lệch giờ sau deploy production (UTC) | Luôn `repeat: { pattern, tz }` — tz theo nghiệp vụ (presence ping tính theo timezone TỪNG guardian, không hardcode 1 nước). |
| Redlock dùng cho payment | Có thể double-charge | Redlock CHỈ cho efficiency (cron dedup). Payment dùng DB transaction + idempotency key Postgres. |
| Cockatiel retry counted vào circuit | Circuit mở quá sớm | `wrap(retryPolicy, circuitBreakerPolicy)` — retry BÊN TRONG, breaker BÊN NGOÀI. |
| Drop column trong migration thường | Mất data production | Add column → backfill → đổi code → 1 sprint → mới drop ở migration riêng có approval. |
| `import` chéo giữa modules | Coupling sâu, không tách được | Đẩy code dùng chung lên `lib/` hoặc `services/`. |
| Service biết HTTP status | Khó test, khó tái sử dụng | Service throw domain string (`PAYMENT_NOT_FOUND`); route map HTTP status. |
| `any` để bypass type error | Bug runtime, mất type-safe | Dùng `unknown` rồi narrow bằng zod.parse hoặc type guard. |
| Hardcode env trong code | Lộ key, không deploy multi-env | Mọi env qua `src/env.ts` (validate Zod). |
| Quên `removeOnComplete` ở Queue | Dragonfly đầy bộ nhớ sau vài ngày | `removeOnComplete: { age: 24*3600, count: 1000 }`. |
| `lockDuration` < thời gian job | Worker bị mark stalled, job re-run | Tăng `lockDuration` hoặc gọi `job.extendLock()` định kỳ. |
| Webhook xử lý sync trong handler | Provider timeout, retry storm | Enqueue + return 200 ngay; xử lý ở worker. |
| Email `dedupKey` chứa timestamp | Dedup không hoạt động | Dùng business identity: `welcome:${userId}`. |
| Sharp `.resize()` trước `.rotate()` | Ảnh chân dung bị xoay ngang | Luôn `.rotate()` (đọc EXIF) trước `.resize()`. |
| Bun.S3Client.presign() dùng await | Type lỗi | Method sync, không phải Promise. Bỏ await. |
| BullMQ custom jobId chứa ":" | `Custom Id cannot contain :` (chỉ lộ khi Redis sống) | Dùng "-": `ping-{guardianId}`. ":" là namespace Redis. |
| Bắt mã PG (23505/23503) bằng `err.code` sau Drizzle | Không match → không catch/retry | Drizzle bọc → mã ở `err.cause`. Đi chuỗi cause. Raw postgres-js thì `err.code` OK. |
| Gate tính năng chỉ theo extension/hạ tầng "có" | 500 khi schema/cột chưa apply | Gate theo trạng thái THẬT (cột tồn tại, migration đã chạy), auto → fallback an toàn. |
| Role toàn cục cho tài nguyên theo-đơn-vị | User A thao tác tài nguyên của B (vd guardian ví khác) | Map user→đơn vị (bảng/claim) + assert scope ở service; scope rỗng = fail-closed. |
| Verify JWT đọc `alg` từ token để chọn cách verify | alg-confusion (RS256→HS256) + alg:none bypass | PIN alg CỨNG, reject mọi alg khác; timing-safe compare; check exp/nbf. |
| Re-check TOCTOU nhưng KHÔNG transaction+lock | Race 2 request song song cùng lọt (double-spend/double-approve) | Bọc quyết định trong `db.transaction` + `pg_advisory_xact_lock` THEO ĐƠN VỊ — serialize, atomicity. |
| Re-check KHÔNG loại chính resource đang xét | Double-submit → resource tự-conflict-chính-nó | Thêm `excludeId` + status guard (chỉ trạng thái hợp lệ mới xử lý). |
| `pkill -f "bun src"` trong test script | Giết oan cả server+worker cùng process-group | `setsid env ... bun ...` tách session cho mỗi background process. |
| Poll job async theo sự tồn tại record | Field của job chạy SAU chưa set → assert ❌ oan | Poll tới khi field của job SAU cũng set, không chỉ record chính. |
| Reviewer agent kêu auth.ts thiếu ULID / withTimezone | Better Auth CLI generated, không phải bug | Exception rõ trong .claude/rules/db-schema.md. Bỏ qua warning cho file `src/db/schema/auth.ts`. |
| Port 6379 bị Redis Windows service chiếm | Memurai/Redis-Windows auto-start, cần admin để stop | Đổi Dragonfly host port trong `.env` (`REDIS_PORT`) + REDIS_URL khớp. |
| `.env.example` REDIS_URL lệch port với `docker-compose.yml` | Project mới clone fail `/ready` 503 cho đến khi sửa tay | Khi đổi port, đồng bộ 2 chỗ cùng lúc: `.env.example` + compose ports. |
| env-guard hook chặn đọc/ghi MỌI file `.env*` (kể cả `.env.example`) | Trong phiên Claude không Read/cat/Write được `.env.example` → biến env mới không doc được tại file mẫu | Ghi biến env mới vào `README.md` + comment ở `src/env.ts`; người dùng tự thêm placeholder vào `.env.example`. |

---

## Follow-up đã biết (hash-guard — track, CHƯA fix)

- **(1) sign-up giữ slot semaphore qua email-await**: `POST /sign-up/email` await `sendVerificationEmail`
  TRONG request (`better-auth` `runInBackgroundOrAwait` → `else await promise` vì `auth.ts` chưa cấu hình
  `advanced.backgroundTasks.handler`). ⇒ slot `hashGuard` bị giữ theo cả độ trễ gửi email, không chỉ scrypt.
  **Fix sau**: cấu hình `backgroundTasks.handler`, HOẶC đẩy email qua BullMQ (async).
- **(2) Live HTTP smoke burst sign-in + đo `/health` p95 + đếm `pg_stat_activity`** — chạy trên staging
  TRƯỚC prod.

## Follow-up đã biết (acceptance CHƯA chạy — staging smoke BẮT BUỘC)

- **SSE cross-process + cluster multi-process CHƯA chạy acceptance thật** trên máy dev. CHƯA chạy:
  cross-process fan-out (cần `RUN_REALTIME_IT=1` + Dragonfly sống) · PID count `WEB_INSTANCES=2` →
  2 api + 1 worker + reusePort share PORT. → **BẮT BUỘC smoke trên staging**
  (Postgres + Dragonfly + `docker compose --profile prod up -d --build`) TRƯỚC khi tin ở prod.

---

## Hậu kiểm

Mỗi lần feature mới đụng vào pattern ở trên → review code 2 lần. Mỗi lần production có sự cố →
bổ sung 1 dòng vào bảng trên + 1 entry chi tiết bên trên.
