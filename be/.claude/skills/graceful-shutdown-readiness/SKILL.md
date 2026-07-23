---
name: graceful-shutdown-readiness
description: Dựng/kiểm graceful shutdown (SIGTERM drain server + BullMQ + pg pool + redis) và tách /health (liveness) vs /ready (readiness check DB + Dragonfly, 503 khi lỗi) cho BE Bun/Hono. Dùng khi user nói "graceful shutdown", "SIGTERM", "drain request", "zero-downtime deploy", "readiness probe", "/ready 503", "rolling deploy mất request", "server không chịu tắt". Chứa gotchas thật: server.stop() treo VÔ HẠN khi còn SSE connection (cần trần drain + stop(true)), thứ tự đóng resource, /ready phải dùng connection fail-fast, PoC signal trên Windows vô nghĩa — dùng Docker.
---

# Graceful shutdown + /health vs /ready (Bun + Hono)

## Shutdown chuẩn (src/index.ts — đã có, ĐỪNG phá thứ tự)

```
SIGTERM/SIGINT → shuttingDown guard
→ race( server.stop() /*drain in-flight*/, sleep(SHUTDOWN_DRAIN_MS=10s) )
→ hết trần chưa drain xong: server.stop(true)  // đóng cứng phần còn lại
→ pgClient.end({timeout: 5})
→ Promise.all([bullConnection.quit(), rateLimitConnection.quit(), closeRealtime()])
→ exit(0);  lỗi giữa chừng → exit(1)
```

- **Vì sao phải có trần drain**: SSE (/api/events) là connection KHÔNG BAO GIỜ
  tự kết thúc. `await server.stop()` trần trụi sẽ treo vô hạn → orchestrator
  hết grace period SIGKILL → mất "clean exit", job/log dở dang. Đo thật:
  có SSE sống, force-close kích ĐÚNG 10.0s sau shutdown.start, exit 0 ở 10.8s;
  không SSE: exit 0 trong <1.5s.
- Client SSE không mất gì: thiết kế at-most-once — FE reconnect + refetch-bù.
- Đóng pool/redis SAU khi drain — đóng trước là request đang chạy 500.
- Worker process riêng (src/workers/index.ts): cùng pattern —
  `Promise.all(workers.map(w => w.close()))` (BullMQ chờ job hiện tại xong,
  không cắt giữa) rồi `bullConnection.quit()`.

## /health vs /ready (src/app.ts — đã có)

- `/health` = liveness: process sống → 200. KHÔNG check downstream — check
  downstream trong liveness là tự sát: DB chớp một cái, orchestrator restart
  cả fleet oan.
- `/ready` = readiness: `db.execute(SELECT 1)` + `rateLimitConnection.ping()`
  → 200; lỗi → **503** (LB/deploy-gate ngừng đẩy traffic, KHÔNG restart).
- `rateLimitConnection` có `enableOfflineQueue: false` → ping fail-fast khi
  Dragonfly chết. Dùng connection offline-queue mặc định là /ready TREO
  thay vì 503 nhanh.

## PoC đúng cách (đã chạy, lặp lại được)

- **Windows không PoC signal được**: `kill`/taskkill = TerminateProcess,
  handler không chạy. Dựng stack Docker cô lập (pg + dragonfly + mailhog +
  oven/bun) — copy source qua `tar --exclude=node_modules` vào volume (đừng
  mount thẳng: bun install trong container ghi đè node_modules Windows),
  `bun install` trong container, chạy, `docker kill -s TERM`, `docker wait`
  lấy exit code.
- Case phải đo đủ: (1) không kết nối treo → drain nhanh exit 0;
  (2) SSE đang mở THẬT (client phải là process sống đọc stream — client
  `docker exec -d` chết sớm tạo bằng chứng GIẢ; sse.disconnected chỉ được
  log ở nhịp heartbeat kế nên timestamp log ≠ thời điểm socket chết);
  (3) /ready 200 deps sống, 503 khi trỏ REDIS_URL vào cổng chết
  (`app.request` là đủ, không cần server).
- Đừng "fix" theo bằng chứng chưa được cô lập: từng suýt thêm
  `idleTimeout: 30` vì tưởng Bun reap SSE giữa heartbeat — client sống đọc
  stream 60s+/3 heartbeat chứng minh giả thuyết sai. Cô lập client trước
  khi đổ cho server.

## Khi thêm resource mới (queue/worker/connection)

Thêm vào ĐÚNG chỗ trong shutdown: worker.close() trước connection.quit();
mọi connection mới phải được quit trong shutdown, nếu không process không
thoát sạch (Bun chờ handle mở).
