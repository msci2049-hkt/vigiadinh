---
name: postgres-drizzle-data
description: Quyết định schema & query Postgres/Drizzle đúng cách cho template BE này. Chọn kiểu id (ULID vs uuidv7 khi PG18), pool size theo process, phân trang keyset thay OFFSET, diệt N+1 bằng inArray, index cho FK/sort/filter, khóa hàng (SELECT FOR UPDATE vs pg_advisory_xact_lock), migration expand-contract an toàn khi có data, bẫy postgres-js (Date/bigint/error.cause), RQB relations() vs defineRelations theo version Drizzle. Dùng khi user gõ "thêm bảng", "query chậm", "phân trang / pagination", "N+1", "pool connection", "too many connections", "khóa row / race condition tiền/tồn kho", "drizzle relations", "nâng Postgres", "migration làm sập app".
---

# Postgres + Drizzle: schema & query đúng

> **One-thing**: quyết định *dữ liệu* (kiểu, khóa, phân trang, index, migration) trên
> template Bun + Drizzle 0.45 + postgres-js. Quy ước schema BẤT BIẾN (1 file 1 bảng, ULID,
> varchar+Zod enum, withTimezone, FK onDelete+index, tiền = integer) nằm ở
> **`.claude/rules/db-schema.md`** — skill này KHÔNG lặp lại, chỉ lo *ra quyết định*.
> Tạo bảng/migration cơ học → skill `new-schema` + `new-migration`. Tiền/ví → `.claude/rules/payment.md`.

## Ground truth (đối chiếu `package.json` + code thật, KHÔNG bịa)

- **Drizzle ORM `^0.45.2`** (KHÔNG phải v1.0) · **drizzle-kit `^0.31.10`** · **postgres-js `^3.4.9`**.
- **Postgres 16** (`docker-compose.yml` = `postgres:16-alpine`, prod default `16.6-alpine`). ⚠️
  Bản đồ tri thức nói nhiều về PG18 — **template chạy PG16**. Tính năng PG18 (uuidv7, generated
  VIRTUAL, `NOT NULL … NOT VALID`, `RETURNING OLD/NEW`, AIO) là **tùy chọn khi nâng**, KHÔNG mặc
  định. Viết code theo PG16; muốn dùng PG18 phải đổi `POSTGRES_IMAGE` trước (xem cuối file).
- 1 pool duy nhất: `src/db/index.ts` → `postgres(env.DATABASE_URL, { max: env.DB_POOL_MAX, idle_timeout: 30, prepare: false })` rồi `drizzle(client, { schema })`. Export `db` + `client`.

## Quyết định 1 — Pool size theo **process**, không theo box

`DB_POOL_MAX` (default 20) là pool **mỗi process**. Cluster spawn `WEB_INSTANCES` process ⇒
tổng connection = `(WEB_INSTANCES + 1 worker) × DB_POOL_MAX`. Guard `src/lib/pool-budget.ts`
**refuse-boot** nếu vượt `80% × PG_MAX_CONNECTIONS`.

- "too many connections" / `/ready` 503 ở tải cao = pool math sai, KHÔNG phải Postgres yếu.
  Giảm `DB_POOL_MAX` hoặc `WEB_INSTANCES`, hoặc thêm PgBouncer. Công thức + tier: **skill `scaling-playbook`**.
- KHÔNG mở pool riêng ngoài `src/db/index.ts` (mỗi `postgres()` là một pool → phá ngân sách).

## Quyết định 2 — Phân trang: **keyset (cursor)**, không OFFSET

OFFSET lớn quét-rồi-bỏ N hàng → chậm tuyến tính + kết quả nhảy khi có insert.

```ts
import { and, eq, lt, desc } from "drizzle-orm";
// cursor = id cuối trang trước (ULID sortable theo thời gian → dùng luôn làm khóa keyset)
const rows = await db.select().from(plots)
  .where(and(eq(plots.communeId, communeId), cursor ? lt(plots.id, cursor) : undefined))
  .orderBy(desc(plots.id))
  .limit(limit + 1); // +1 để biết còn trang sau
const hasNext = rows.length > limit;
const items = hasNext ? rows.slice(0, limit) : rows;
const nextCursor = hasNext ? items[items.length - 1]?.id : null;
```

OFFSET chỉ chấp nhận cho admin table nhỏ, hữu hạn trang. Reference thật FE cũng phân trang
`{ limit, offset }` cho admin (users-management) — đó là chủ đích (bảng nhỏ), không phải mẫu cho list lớn.

## Quyết định 3 — N+1 → **inArray**, không loop query

```ts
import { inArray } from "drizzle-orm";
// ❌ N+1: for (const p of plots) await db.select()...where(eq(docs.plotId, p.id))
// ✅ 1 query rồi group ở app:
const ids = plots.map((p) => p.id);
const docs = ids.length ? await db.select().from(plotDocuments).where(inArray(plotDocuments.plotId, ids)) : [];
const byPlot = Map.groupBy(docs, (d) => d.plotId);
```

- `inArray(col, [])` → Drizzle sinh `false` (0 hàng), an toàn — nhưng vẫn nên guard mảng rỗng để khỏi round-trip.
- Cần join thật + nested → Relational Query (Quyết định 7), không tự nối tay.

## Quyết định 4 — Index cho **FK · cột ORDER BY · cột WHERE lọc**

`db-schema.md` bắt FK có index. Ngoài ra: cột dùng trong `orderBy`/keyset và cột lọc tần suất cao
phải có index (composite khi lọc-rồi-sắp). Không có index trên cột keyset ⇒ `desc(id)` vẫn ok (PK),
nhưng lọc `communeId` + sort `id` cần `index(communeId, id)`.

```ts
(t) => ({ byCommune: index("plots_commune_id_idx").on(t.communeId, t.id) })
```

Đo trước khi thêm: `EXPLAIN (ANALYZE, BUFFERS)` thấy `Seq Scan` trên bảng lớn = thiếu index.

## Quyết định 5 — Khóa: `SELECT FOR UPDATE` (row) vs `pg_advisory_xact_lock` (logic)

| Cần | Dùng | Vì |
|---|---|---|
| Sửa 1 hàng cụ thể (trừ số dư ví) | `.for("update")` trong `db.transaction` | Khóa đúng hàng, tự nhả cuối tx. Xem `.claude/rules/payment.md`. |
| Serialize theo **đơn vị nghiệp vụ chưa có hàng** (chia đợt, chống double-approve) | `pg_advisory_xact_lock(hashtextextended(key, 0))` trong tx | Re-check TOCTOU KHÔNG đủ (BUG-008 chia tiền 2 lần). Lock theo *khái niệm*, không theo row. |

```ts
// Mẫu THẬT: src/modules/approval/service.ts:97 — lock theo đơn vị nghiệp vụ (xã), không theo row
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`approve:${communeId}`}))`);
  // ... re-đọc trạng thái BÊN TRONG lock rồi mới ghi (re-check TOCTOU đơn thuần KHÔNG đủ)
});
```

**KHÔNG Redlock cho tiền/tồn kho** — Redlock = efficiency, không phải correctness (`payment.md`, `lib/redlock.ts`).

## Quyết định 6 — Migration khi bảng đã có data: **expand-contract**

Migration chạy ở gate deploy TRƯỚC khi app mới lên → app **cũ** vẫn chạy trên schema **mới** vài giây.
Nên mọi migration phải additive trước (chi tiết + workflow 3-release: `db-schema.md`):

- Thêm cột `NOT NULL` không default trên bảng có data = **lock + fail**. → thêm nullable/có default →
  backfill → siết NOT NULL ở migration sau (PG16: `ADD CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE
  CONSTRAINT` → `SET NOT NULL`; PG18 rút gọn bằng `ALTER … SET NOT NULL … NOT VALID`).
- KHÔNG rename trực tiếp (app cũ query tên cũ → 500). Đọc kỹ câu hỏi rename của drizzle-kit
  ("Is X a renamed of Y?" — chọn No = **DROP + ADD = mất data**).
- KHÔNG sửa tay `drizzle/*.sql`. Luôn ĐỌC SQL sinh ra trước khi apply.

## Quyết định 7 — Relations: `relations()` (Drizzle 0.45, HIỆN TẠI)

```ts
// src/db/schema/plots.ts — API 0.45.x
import { relations } from "drizzle-orm";
export const plotsRelations = relations(plots, ({ many }) => ({ documents: many(plotDocuments) }));
// đọc: db.query.plots.findMany({ with: { documents: true } })
```

⚠️ **Khi (nếu) nâng Drizzle v1.0**: API đổi sang `defineRelations()` và `db.query` **bị swap**
(v2 nằm ở `db.query`, API cũ dời sang `db._query`). Copy code mẫu từ docs mới mà repo còn 0.45 =
gãy ngay. Giữ 0.45 → dùng `relations()`. Đừng nâng lẻ.

## GOTCHAS (đã trả giá thật — đọc trước khi debug)

- **PG error code bị Drizzle bọc** (BUG-005b): `err.code === "23505"` KHÔNG match vì Drizzle bọc
  `PostgresError` trong lớp ngoài. Middleware `src/middlewares/error.ts` đọc `(err as {code}).code`
  ở TOP-LEVEL (đúng cho error nổi thẳng lên); nhưng khi bạn `try/catch` quanh `.insert()` ở service,
  code 23505/23503 thường nằm ở **`err.cause`** → đi chuỗi `err.cause` để lấy `.code`, đừng so ở lớp ngoài.
- **postgres-js trả `Date` cho timestamptz** và **string cho numeric/bigint**. Cột `bigint` (tiền VND
  carbon: `wallet-txns`, `pool-*`) PHẢI khai `bigint("amount", { mode: "number" })` mới ra number; quên
  `mode` → nhận string, cộng chuỗi ra bug tiền. `integer` thì ra number sẵn.
- **`prepare: false` là CỐ Ý** (comment `db/index.ts`): postgres-js cache prepared-statement per-connection,
  pool transient → cache-miss cao + cần cho PgBouncer transaction mode sau này. ĐỪNG bật lại để "tối ưu".
- **Test "(Postgres thật)" đỏ giả** (BUG-012/014): port 5432 có thể là Postgres **dự án khác** (cột lệch
  như `org_id`) → fail-env, KHÔNG phải lỗi code. `pgReachable()` skip-nêu-lý-do; trỏ `DATABASE_URL` vào
  đúng stack template. Skip ≠ pass. Xem `.claude/rules/docker.md` + skill `testing-be`.
- **SQLi định danh vs bind**: giá trị luôn qua bind param (Drizzle/`sql``…${x}` tự tham số hóa). Nhưng
  **tên bảng/cột động KHÔNG được bind** — nếu buộc phải dynamic identifier, allowlist cứng, đừng nội suy chuỗi.
- **`Map.groupBy` cần Bun/Node mới** — repo chạy Bun 1.3.x nên OK; nếu target khác thì tự group bằng reduce.

## Cross-reference

`scaling-playbook` (pool math, PgBouncer, tier) · `cluster-stateless` (Postgres = nguồn sự thật, cache/lock
qua Dragonfly) · `.claude/rules/db-schema.md` (quy ước schema) · `.claude/rules/payment.md` (tiền, row lock) ·
skill `new-schema` / `new-migration` (thao tác cơ học).

## Nâng lên PG18 (nếu thật sự cần)

Đổi `POSTGRES_IMAGE` (prod compose) + image dev sang PG18, `pg_upgrade` giữ planner stats. Chỉ khi đó mới
được dùng: `uuidv7()` DB-side cho bảng MỚI (locality như BIGSERIAL, hết tranh cãi ULID-vs-UUID — bảng cũ giữ
ULID), generated column (mặc định VIRTUAL **không index được** → khai `STORED` nếu cần index), `RETURNING
OLD/NEW` cho audit, `ADD … NOT NULL NOT VALID`. Trước khi nâng: đọc release notes, test migration trên copy.
