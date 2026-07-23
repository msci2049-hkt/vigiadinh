---
name: scaling-playbook
description: Chọn ĐÚNG chiều scale cho BE này và ĐO trước khi đổi. Bao nhiêu web process (WEB_INSTANCES) và pool DB (DB_POOL_MAX) theo core, công thức ngân sách connection, khi nào cần PgBouncer transaction mode, khi nào read replica (và vì sao đọc tiền phải trỏ primary), khi nào partition/shard. Dùng khi user gõ "scale", "chịu tải bao nhiêu / 10k user", "too many connections", "/ready 503", "p95 cao / chậm khi tải", "thêm read replica", "cần PgBouncer chưa", "app sập khi nhiều request", "tối ưu Postgres", "nâng core/RAM". Đọc TRƯỚC khi đổi WEB_INSTANCES/DB_POOL_MAX hay thêm hạ tầng — sai chiều scale là đốt tiền mà không hết nghẽn.
---

# Scaling playbook: đo trước, scale đúng chiều

> **One-thing**: quyết định *scale cái gì, tới đâu*. Vận hành chi tiết (bảng tier, deploy cluster, proxy SSE,
> checklist) nằm ở **`docs/SCALE-RUNBOOK.md`** — skill này là lớp quyết định + đo lường ở trên nó, KHÔNG lặp lại.

## Luật số 0 — ĐO trước, đừng đoán

Read replica KHÔNG cứu nghẽn **ghi**; thêm process KHÔNG cứu nghẽn **DB connection**; cache KHÔNG cứu query
thiếu index. Sai chiều = tốn tiền, nghẽn vẫn còn. Trước mọi thay đổi, đo và đọc con số:

| Đo gì | Bằng gì | Ngưỡng báo động |
|---|---|---|
| Query nào tốn nhất | `pg_stat_statements` (total_exec_time, calls) | 1-2 query chiếm phần lớn thời gian → tối ưu/index trước khi scale |
| Kết nối đang dùng | `SELECT count(*), state FROM pg_stat_activity GROUP BY state` | gần `max_connections` → pool math / PgBouncer, KHÔNG thêm process |
| Latency | p95/p99 per-route (Sentry/pino) | p95 tăng khi tải → tìm nguồn (DB? CPU hash? lock?) |
| Cache hit | Dragonfly hit-rate | thấp → cache-aside sai key/TTL (skill `caching-patterns`) |
| Replica lag | `pg_stat_replication` | lag cao → KHÔNG đọc dữ liệu cần fresh từ replica |

`EXPLAIN (ANALYZE, BUFFERS)` cho query chậm: thấy `Seq Scan` bảng lớn = thiếu index (skill
`postgres-drizzle-data`), không phải thiếu core.

## Chiều 1 — Web process (CPU-bound / concurrency)

`WEB_INSTANCES` process cùng bind PORT (SO_REUSEPORT, Linux-only). Số hợp lý ≈ **core/2** (chừa core cho
worker + Dragonfly + Postgres cùng box). Ràng buộc chéo:

- **Login CPU guard**: `WEB_INSTANCES × HASH_MAX_CONCURRENT ≤ ~2×core`. Vượt → scrypt ăn hết CPU, p95 MỌI
  route tăng (self-DoS). Default `HASH_MAX_CONCURRENT=2` + `WEB_INSTANCES≈core/2` là an toàn.
- Set `WEB_INSTANCES` **tường minh** — KHÔNG suy từ `nproc`/`hardwareConcurrency` (trong container báo core
  HOST, sai khi `--cpus`).

## Chiều 2 — DB connection (nghẽn hay gặp nhất)

```
Σ (WEB_INSTANCES × DB_POOL_MAX) + worker_pool + reserve  ≤  80% × PG_MAX_CONNECTIONS
```

Boot **tự refuse** nếu `(WEB_INSTANCES+1) × DB_POOL_MAX > 80% × PG_MAX_CONNECTIONS` (`src/lib/pool-budget.ts`
→ `process.exit(1)`, log `pool-budget.REFUSE-BOOT`). "too many connections" ngẫu nhiên ở tải cao = vượt ngân
sách. Cách xử theo thứ tự: (1) giảm `DB_POOL_MAX`, (2) giảm `WEB_INSTANCES`, (3) tăng `max_connections`, (4)
≥16 core hoặc app-conn > max_connections → **PgBouncer**.

**PgBouncer transaction mode** (khi app-conn nhiều hơn PG-conn muốn giữ): ghép nhiều pool app xuống ít
connection PG. Nhưng transaction mode **phá prepared statement** xuyên tx → app đã set `prepare: false` sẵn
(`src/db/index.ts`), nên tương thích. Muốn bật lại prepared: PgBouncer `max_prepared_statements ≥ 1` (có từ
PgBouncer 1.21+, dòng 1.25 ổn định) — kiểm changelog bản đang dùng. Không làm 1 trong 2 → lỗi `prepared
statement "s0" already exists` rải rác.

## Chiều 3 — Read replica (đọc nhiều, KHÔNG cứu ghi)

- Chỉ giảm tải **đọc**. Không giảm tải ghi (write vẫn về primary). Nghẽn ghi → xem Chiều 4.
- **Dữ liệu cần fresh (tiền, số dư, trạng thái đơn vừa đổi) PHẢI đọc primary** — replica lag làm đọc số cũ →
  quyết định sai (rút quá số dư, duyệt nhầm). Route replica chỉ cho đọc chịu được stale (danh sách, thống kê).

## Chiều 4 — Ghi (partition/shard, chỉ khi thật sự nghẽn ghi)

- **Partition** (theo thời gian/tenant) trước: bảng append lớn (audit, event, txn) → prune/vacuum rẻ hơn.
- **Shard** (chia DB) là bước cuối, chỉ khi **ghi** thật sự vượt 1 primary — phức tạp lớn, đừng làm sớm.
- Worker: BullMQ chia job → scale worker ×N khi **job** (không phải cron) là bottleneck. Cron đã redlock-dedup
  nên nhiều worker vẫn chạy 1 lần (skill `cluster-stateless`). Baseline worker ×1.

## Bảng tier khởi đầu (chi tiết đầy đủ: `docs/SCALE-RUNBOOK.md`, giả định max_connections=100)

| Core | WEB_INSTANCES | DB_POOL_MAX | Σ web conn | PgBouncer |
|---|---|---|---|---|
| 4 | 2 | 10 | 20 | ❌ direct |
| 8 | 4 | 10 | 40 | ❌ direct |
| 16 | 8 | 8 | 64 | ✅ transaction + `prepare:false` |
| 32 | 16 | 8 | 128 | ✅ bắt buộc (128 > 100) |

Con số khởi đầu an toàn, KHÔNG cứng — đo `pg_stat_activity` + p95 rồi chỉnh.

## GOTCHAS

- **`assertPoolBudget` giả định đúng 1 worker** (`WORKER_RESERVE = 1` trong `pool-budget.ts`). Nếu scale
  worker ×N (`--scale worker=N`), ngân sách **under-count** N-1 pool → có thể vượt max_connections mà guard
  không chặn. Baseline worker ×1; scale worker → tính lại tay hoặc chỉnh `PG_MAX_CONNECTIONS` cho đúng.
- **`CPU_CORES`/`PG_MAX_CONNECTIONS` sai = guard vô nghĩa**: đặt = giá trị Postgres thật + `--cpus` thật của
  container, KHÔNG để default 100/hardwareConcurrency trong prod (báo core HOST).
- **Dragonfly cần AVX2**: VPS cũ thiếu AVX2 → Dragonfly không chạy (kiểm `lscpu | grep avx2`). Đa-process =
  Dragonfly là SPOF đường đồng bộ → `/ready` phải kiểm nó; cân nhắc HA.
- **Proxy nuốt SSE khi scale sau nginx**: thiếu `proxy_buffering off` + read timeout dài → client không nhận
  realtime dù BE publish đúng.
- **PG18 AIO là tùy chọn khi nâng, không phải mặc định**: template chạy **PG16**. PG18 có `io_method=worker`
  (default) / io_uring (Linux) tăng seq-scan & vacuum trên I/O-bound; nâng PG18 giữ được planner stats qua
  `pg_upgrade`. Chỉ cân nhắc khi đã đo I/O là nghẽn — không nâng mù. Xem `postgres-drizzle-data` §PG18.

## Cross-reference

`cluster-stateless` (state qua Dragonfly khi đa-process) · `postgres-drizzle-data` (pool/process, index, keyset) ·
`caching-patterns` (giảm tải đọc) · `bullmq-jobs` (scale worker) · `graceful-shutdown-readiness` (/ready) ·
`docs/SCALE-RUNBOOK.md` (tier + deploy mechanics đầy đủ).
