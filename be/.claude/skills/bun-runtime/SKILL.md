---
name: bun-runtime
description: Chạy & build đúng trên Bun cho template BE này. Bun.serve reusePort (cluster), graceful shutdown có trần drain, Bun.spawn dạng cmd-array (không shell), honest build (bun build --target bun --minify) + --frozen-lockfile, và các giới hạn Bun 1.3 phải biết khi viết code (Bun.SQL chỉ tagged-template, Bun.redis chưa có streams/Lua/cluster → BullMQ+SSE vẫn ioredis). Dùng khi user gõ "Bun.serve", "chạy nhiều process", "graceful shutdown", "bun build", "bun spawn / chạy lệnh ngoài", "dọn dependency ioredis", "Bun.SQL", "Bun.redis", "nâng Bun 1.3", "server không tắt", "WSL không gọi được server". Đọc TRƯỚC khi thay ioredis bằng Bun built-in hay đổi cách boot/build.
---

# Bun runtime: serve, build, spawn, giới hạn

## Boot & serve (mẫu thật `src/index.ts`)

```ts
import "@/lib/sentry";            // DÒNG ĐẦU — side-effect init trước mọi module (đảo = miss boot error)
const server = Bun.serve({ port: env.PORT, reusePort: true, fetch: app.fetch });
```

- `reusePort: true` → N process share PORT (SO_REUSEPORT, **Linux-only**). Supervisor = `src/cluster.ts`
  (`Bun.spawn`, KHÔNG `node:cluster`). Số process/pool: skill `scaling-playbook`.
- `assertPoolBudget()` gọi lúc boot (single-process/dev) — refuse boot nếu pool vượt ngân sách.

## Graceful shutdown (BẮT BUỘC có trần drain)

`server.stop()` một mình **treo vô hạn** khi còn SSE connection (không bao giờ tự đóng). Mẫu `src/index.ts`:
`Promise.race([server.stop(), Bun.sleep(10_000)])` → hết trần thì `server.stop(true)` đóng cứng → rồi
`pgClient.end({timeout:5})` + `bull/rateLimit.quit()` + `closeRealtime()` → `exit(0)`. Thêm resource mới (queue,
connection) → nối vào đây, nếu không rolling deploy mất request. Chi tiết + PoC: skill `graceful-shutdown-readiness`.

## Build honest

```bash
bun build src/index.ts --outdir dist --target bun --minify   # script "build"
bun install --frozen-lockfile                                 # CI: khóa lockfile (supply-chain)
```

`--target bun` (không phải node). Prod CMD = `bun run dist/cluster.js`. `typecheck` = `bunx tsc --noEmit`
(strip-types của Bun **không** bắt lỗi type → tsc là gate thật, nằm trong `bun run validate`).

## Bun.spawn — cmd-array, KHÔNG shell string

```ts
Bun.spawn(["bun", "run", childEntry], { env: {...}, stdout: "inherit" });   // ✅ no shell → không injection
// ❌ KHÔNG nội suy chuỗi vào shell (`sh -c "... ${userInput}"`) — command injection
```

## GOTCHAS (Bun 1.3 — repo pin CI `1.3.11`, Docker `oven/bun:1.3.8`)

- **Bun.redis CHƯA có streams/Lua/cluster** → BullMQ và SSE replay (XADD) **VẪN dùng `ioredis`** (`src/lib/redis.ts`,
  `realtime.ts`). ĐỪNG "dọn dependency" thay ioredis bằng Bun.redis — sẽ mất queue/streams. Đây là quyết định có
  chủ đích, không phải nợ.
- **Bun.SQL chỉ nhận tagged-template** — gọi như hàm thường = throw (breaking 1.3). Repo dùng `postgres-js` +
  Drizzle (`src/db/index.ts`), KHÔNG Bun.SQL — giữ nguyên.
- **WSL2 (máy dev) Bun.serve inbound HỎNG**: `Bun.serve({port})` log "listening" nhưng KHÔNG bind socket tới
  được (curl → 000). → Test HTTP flow bằng **`app.request(...)`** / `app.fetch(new Request(...))` (cùng code path,
  không cần TCP). Mẫu: `src/middlewares/hash-guard.test.ts`. Outbound (PG/Dragonfly) vẫn OK. Skill `testing-be`.
- **`bun` trên PATH máy dev có thể là `bun.exe` Windows** → env-var override kiểu `X=1 bun test` KHÔNG tới nó; dùng
  `bun --env-file=<file>`. Bun Linux native ở `~/.bun/bin/bun` (ưu tiên).
- **Nâng Bun 1.3**: `Bun.serve` TS types viết lại + tsconfig default `"module":"Preserve"` (breaking) — đọc changelog
  trước khi bump. Bật `minimumReleaseAge` + Security Scanner API chống supply-chain (skill `supply-chain-guard`).
- **`better-sqlite3` node-gyp trong image bun** (BUG-013): `docker build` fail vì build native → stage `deps` cài
  `--ignore-scripts`. `bunx @better-auth/cli` cũng node-gyp better-sqlite3 → `auth:generate` fail trên Windows.

## Cross-reference

`scaling-playbook` (reusePort/cluster/process) · `cluster-stateless` (state không ở RAM) · `graceful-shutdown-readiness`
(shutdown/ready) · `supply-chain-guard` (frozen-lockfile, scanner) · `testing-be` (app.request) · `bullmq-jobs` (ioredis).
