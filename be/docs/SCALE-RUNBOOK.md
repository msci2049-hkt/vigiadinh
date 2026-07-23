# Scale Runbook — multi-process / multi-core

> Hướng dẫn scale 1 box theo số core: số web instance, pool DB, khi nào cần PgBouncer,
> và các ràng buộc chéo (login CPU guard, Dragonfly SPOF). Template-generic — chỉnh theo `max_connections` thật.

## Khi nào đọc

- Tăng core/RAM cho box hiện tại, hoặc bật cluster nhiều process (`reusePort`).
- Thấy `/ready` 503, `too many connections` Postgres, hoặc p95 login tăng khi tải cao.

## Khái niệm (knob thật trong repo)

| Knob | Ở đâu | Ý nghĩa |
|---|---|---|
| `WEB_INSTANCES` | deploy/PM2 (số process `bun src/index.ts`) | Số process HTTP cùng bind `PORT`. |
| `DB_POOL_MAX` | `src/env.ts` (default 20) | Pool Postgres **mỗi process**. |
| `HASH_MAX_CONCURRENT` | `src/env.ts` (default 2) | Trần scrypt đồng thời **mỗi process** (`middlewares/hash-guard.ts`). |
| `cookieCache.maxAge` | `src/lib/auth.ts` (300s) | TTL session cache trong cookie (xem `.claude/rules/auth.md`). |
| `reusePort` | `Bun.serve({ reusePort: true })` | Cho N process share 1 port (SO_REUSEPORT). |

## Bảng tier theo core

Giả định Postgres `max_connections = 100` (managed PG khác → quy đổi theo công thức bên dưới).

| Core | WEB_INSTANCES | DB_POOL_MAX | Σ web conn | Worker | PgBouncer | Box hash = WEB×HASH_MAX_CONCURRENT |
|---|---|---|---|---|---|---|
| 4   | 2  | 10 | 20  | ×1 | ❌ direct | 4 ≤ 8 |
| 8   | 4  | 10 | 40  | ×1 | ❌ direct | 8 ≤ 16 |
| 16  | 8  | 8  | 64  | ×1 | ✅ transaction mode + `prepare:false` | 16 ≤ 32 |
| 32  | 16 | 8  | 128 | ×1–2 | ✅ **bắt buộc** (128 > max_connections) | 32 ≤ 64 |

> Đây là điểm khởi đầu an toàn, không phải con số cứng — đo `pg_stat_activity` + p95 rồi tinh chỉnh.

## Công thức kết nối DB

```
Σ (WEB_INSTANCES × DB_POOL_MAX) + worker_pool + reserve  ≤  80% × max_connections
```

- `reserve` = chừa cho migration, `db:studio`, cron, healthcheck (~10–15 connection).
- Vượt ngưỡng → **PgBouncer** (transaction pooling): app giữ nhiều pool, PgBouncer multiplex
  xuống ít connection thật tới Postgres (vd 128 app-conn → 20–40 PG-conn).
- 80% (không phải 100%): chừa headroom cho spike + superuser slot.

## PgBouncer ở 16-core+ (transaction mode)

- **Transaction mode** mới đạt tỉ lệ ghép cao, NHƯNG **phá prepared statement** xuyên transaction.
- postgres.js (driver Drizzle) → set **`prepare: false`** trong `src/db/index.ts`.
- HOẶC PgBouncer đủ mới để giữ prepared statement trong transaction mode (`max_prepared_statements ≥ 1`, có từ **PgBouncer 1.21+** — kiểm changelog bản đang dùng).
- Không làm 1 trong 2 → lỗi `prepared statement "s0" already exists` rải rác khi tải.

## Web process: `reusePort` + AVX2

- `reusePort: true` để N process cùng nghe `PORT` (kernel load-balance) — **CHỈ Linux** (SO_REUSEPORT).
  macOS/Windows: chạy **1 process** khi dev (reusePort không cân tải như Linux).
- **Dragonfly cần CPU có AVX2** — VPS quá cũ thiếu AVX2 sẽ không chạy Dragonfly.
- Số web instance hợp lý ≈ core/2 (chừa core cho worker + Dragonfly + Postgres cùng box).

## Worker: ×1, cron đã dedup

- Job throughput có thể scale nhiều worker process (BullMQ chia job).
- **Cron** đã chống chạy trùng bằng `redlock.using(...)` (xem `new-cron`) → dù nhiều worker pick
  cùng tick, chỉ 1 chạy, còn lại `cron.skipped-locked`. Baseline khuyến nghị **worker ×1**;
  scale lên ×N chỉ khi job (không phải cron) là bottleneck.

## Login CPU guard ↔ số process

`HASH_MAX_CONCURRENT` là trần **mỗi process**. Trần thật của box:

```
WEB_INSTANCES × HASH_MAX_CONCURRENT  ≤  ~2 × core
```

- Vượt → nhiều request scrypt đồng thời ăn hết CPU, p95 mọi route (kể cả `/health`) tăng → self-DoS.
- Default `HASH_MAX_CONCURRENT=2` + `WEB_INSTANCES≈core/2` ⇒ box hash ≈ core ≤ 2×core: an toàn.
- Burst quá ngưỡng → `hash-guard` trả **503** fail-fast (`HASH_ACQUIRE_TIMEOUT_MS`, `HASH_MAX_QUEUE`),
  không để hàng đợi vô hạn.

## Dragonfly = SPOF đồng bộ khi đa-process

Khi chạy nhiều process, mọi state chia sẻ nằm ở Dragonfly:

- secondaryStorage session (prod), rate-limit, BullMQ, denylist thu hồi cookie-cache.

→ Dragonfly chết = **đường đồng bộ** (login rate-limit, session lookup nhanh, queue) gãy.

- Healthcheck `/ready` phải kiểm Dragonfly.
- Cân nhắc Dragonfly HA / replica khi đa-process là production-critical.
- Path I/O nền vẫn nên qua BullMQ (retry) thay vì làm sync trong request.

## Cookie-cache revocation (nhắc lại)

Đa-process ⇒ thu hồi session (logout/ban/hạ quyền) trễ tới `cookieCache.maxAge` (5 phút) vì cache
nằm trong cookie, không share. Route nhạy → denylist Dragonfly (OPTIONAL). Chi tiết + code mẫu:
`.claude/rules/auth.md` mục "Cookie-cache: cửa sổ thu hồi".

## Deploy mechanics (cluster.ts + Docker)

- **Web**: CMD = `dist/cluster.js` (supervisor). Đọc `WEB_INSTANCES`, spawn N bản
  `dist/index.js` — mỗi bản `Bun.serve({ reusePort: true })` share PORT. 1 child chết →
  supervisor `exit(1)` → Docker `restart: unless-stopped` dựng lại container. **KHÔNG
  node:cluster** (Bun chưa battle-tested) — chỉ spawn process + SO_REUSEPORT.
- **WEB_INSTANCES TƯỜNG MINH** — KHÔNG suy từ `nproc`/`hardwareConcurrency`: trong
  container chúng báo core HOST (sai khi `--cpus`). Set theo bảng tier ở trên.
- **reusePort = Linux-only**: Docker Desktop (Mac/Win) cân tải SO_REUSEPORT khác Linux —
  prod chạy Linux. Dev macOS/Win: 1 process (`bun run dev`).
- **AVX2 bắt buộc cho Dragonfly**: kiểm VPS `lscpu | grep -o avx2` — trống = Dragonfly không chạy.
- **Pool-budget refuse-boot**: boot tự `process.exit(1)` nếu
  `(WEB_INSTANCES+1)×DB_POOL_MAX > 80%×PG_MAX_CONNECTIONS` (`src/lib/pool-budget.ts`). Set
  `PG_MAX_CONNECTIONS` = giá trị Postgres thật; `CPU_CORES` = `--cpus` thật (cảnh báo hash chuẩn).
- **Worker ×1**: service `worker` riêng (compose profile `prod`), `RUN_MIGRATIONS=false`
  (api đã migrate ở entrypoint). KHÔNG `--scale worker=N` (cron redlock-dedup nhưng 1 là baseline).
- **SSE qua proxy**: `proxy_buffering off;` + `proxy_read_timeout` dài (heartbeat 20s lo idle).
  Thiếu → proxy buffer SSE, client không nhận realtime.
- Chạy prod stack: `docker compose --profile prod up -d --build` (dev `up` vẫn chỉ infra).

## Checklist khi scale

- [ ] Tính `Σ(WEB_INSTANCES × DB_POOL_MAX) + reserve ≤ 80% × max_connections`.
- [ ] ≥ 16 core → PgBouncer transaction mode + `prepare:false` (hoặc PgBouncer ≥1.21).
- [ ] `WEB_INSTANCES × HASH_MAX_CONCURRENT ≤ ~2×core`.
- [ ] `reusePort` chỉ bật trên Linux; CPU có AVX2 (cho Dragonfly).
- [ ] Worker ×1 baseline (cron đã redlock-dedup).
- [ ] `/ready` kiểm Postgres + Dragonfly; đo `pg_stat_activity` + p95 sau khi đổi.
- [ ] CMD = `dist/cluster.js`; `WEB_INSTANCES` set tường minh (KHÔNG nproc).
- [ ] Boot log `pool-budget.ok` (không `REFUSE-BOOT`); `PG_MAX_CONNECTIONS` + `CPU_CORES` đúng prod.
- [ ] Proxy SSE: `proxy_buffering off` + read timeout dài.
