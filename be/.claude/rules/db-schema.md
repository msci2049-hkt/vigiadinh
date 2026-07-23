---
globs: src/db/schema/**,drizzle/**,drizzle.config.ts
description: Drizzle schema patterns. ULID PK, no DROP COLUMN, no pgEnum, FK index.
---

# Rule: Drizzle DB schema

Áp dụng khi sửa schema, migration, hoặc drizzle config.

## 1 file 1 bảng

```
src/db/schema/
├── index.ts              ← re-export
├── auth.ts               ← Better Auth CLI sinh (user/session/account/verification) — KHÔNG sửa tay
├── wallets.ts
├── payments.ts
└── ...
```

KHÔNG nhét nhiều bảng vào 1 file. Re-export qua `index.ts`:

```ts
export * from "./auth";
export * from "./wallets";
```

(Schema nằm trong module Vertical Slice — `src/modules/<m>/infra/<m>.schema.ts` — cũng phải
re-export ở `src/db/schema/index.ts` để drizzle-kit thấy.)

## Primary key: ULID 26 ký tự

```ts
// ✅
id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),

// ❌ — serial dễ enumerate, uuid v4 không sortable
id: serial("id").primaryKey(),
id: uuid("id").primaryKey().defaultRandom(),
```

ULID = sortable theo time, btree không fragment, frontend-safe.

### Ngoại lệ: bảng do CLI sinh

Bảng do Better Auth CLI sinh (`src/db/schema/auth.ts`) dùng `text("id")` thay vì `varchar(26)` ULID.
ĐÂY LÀ INTENTIONAL — file CLI generated, KHÔNG sửa tay (xem `.claude/rules/auth.md`).

Rule ULID áp dụng cho bảng **tự viết** (`payments`, `wallets`, `guardians`, v.v.).
Bảng CLI generated giữ format CLI để `bun run auth:generate` lần sau không conflict.
**KHÔNG có bảng `users` nghiệp vụ** — user là bảng `user` của Better Auth (id `text`).

## "Enum" dùng varchar + Zod, KHÔNG pgEnum

```ts
// ✅
status: varchar("status", { length: 16 }).notNull().default("pending"),
// ở dto.ts:
status: z.enum(["pending", "success", "failed"])

// ❌ — pgEnum: thêm value phải ALTER TYPE, không rollback dễ
status: pgEnum("status", ["pending", "success", "failed"])("status"),
```

## Timestamp LUÔN có timezone

```ts
// ✅
createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

// ❌ — lệch giờ sau deploy production (server UTC vs VN)
createdAt: timestamp("created_at").notNull().defaultNow(),
```

### Ngoại lệ: bảng do CLI sinh

Better Auth schema (`src/db/schema/auth.ts`) dùng `timestamp()` không có `withTimezone: true`.
ĐÂY LÀ INTENTIONAL — không sửa tay. App layer convert timezone khi đọc nếu cần.

Rule `withTimezone: true` áp dụng cho bảng tự viết.

## Tham chiếu tới user = SOFT REF, KHÔNG hard FK

Bảng `user` do Better Auth CLI sinh, khóa chính kiểu `text`; quy ước template là ULID
`varchar(26)`. Hai kiểu không ghép FK cứng được, và file `auth.ts` là CLI-generated
(regenerate bất kỳ lúc nào) — FK cứng trỏ vào đó là bom nổ chậm.

```ts
// ✅ — soft ref + index BẮT BUỘC
userId: varchar("user_id", { length: 64 }).notNull(),
// (t) => [index("wallets_user_id_idx").on(t.userId)]

// ❌ — KHÔNG có bảng `users` nghiệp vụ; user của Better Auth không FK được
userId: varchar("user_id", { length: 26 }).references(() => users.id),
```

Toàn vẹn dữ liệu với user enforce ở tầng service (user tồn tại vì đã qua auth middleware).

## FK cứng CHỈ giữa các bảng TỰ VIẾT — và MUST có onDelete

```ts
// ✅ — cả hai bảng đều tự viết (guardians → wallets), FK cứng OK
walletId: varchar("wallet_id", { length: 26 })
  .notNull()
  .references(() => wallets.id, { onDelete: "cascade" }),  // chọn rõ ràng
```

Options:
- `restrict` — không cho xoá parent nếu còn child (default an toàn cho payment/wallet).
- `cascade` — xoá parent → xoá child (cho record phụ thuộc hẳn vào parent).
- `set null` — child set null khi xoá parent (cho ref phụ, cột phải nullable).

## FK MUST có index

```ts
(t) => ({
  userIdx: index("payments_user_id_idx").on(t.userId),
})
```

JOIN trên FK không có index = full scan, chậm 1000x ở 100k rows.

## Idempotency key MUST UNIQUE

```ts
(t) => ({
  dedupUq: uniqueIndex("webhook_events_provider_extid_uq").on(t.provider, t.externalId),
})
```

INSERT lần 2 throw 23505 → catch và trả deduplicated.

## Tiền lưu INTEGER (cents)

```ts
// ✅ — 10000 = 100.00 VND
amount: integer("amount").notNull(),

// ❌ — float sai số
amount: real("amount").notNull(),
```

## Audit log: append-only, có index theo entity

```ts
export const auditLogs = pgTable("audit_logs", {
  id: ...,
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: varchar("entity_id", { length: 26 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  actorId: varchar("actor_id", { length: 64 }),  // nullable (system action) — soft ref tới user (id text)
  diff: jsonb("diff"),
  createdAt: ...,
}, (t) => ({
  entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  actorIdx: index("audit_logs_actor_idx").on(t.actorId),
}));
```

## Additive-first (mọi migration production)

Migration chạy ở GATE trước khi up app (deploy.sh) — bản app CŨ vẫn đang chạy
trên schema MỚI vài giây/phút. Vì vậy:

1. **Thêm cột: nullable (hoặc có DEFAULT) trước.** `NOT NULL` không default trên
   bảng có data = lock + fail. Siết `NOT NULL` ở migration SAU, khi code đã ghi đủ.
2. **Không rename trực tiếp** (app cũ query tên cũ → 500). Đi 2 bước: add cột mới
   + dual-write/backfill → migration sau mới bỏ cột cũ (theo workflow 3-release dưới).
3. Drop/thu hẹp kiểu → luôn là release SAU release ngừng-dùng.

## DROP COLUMN — workflow 3-release

KHÔNG drop trực tiếp. Đi 3 release:

1. **Release N**: đánh dấu `@deprecated` trong comment, KHÔNG ghi vào field này nữa (chỉ đọc). Add field mới + backfill nếu thay thế. Deploy. Đợi ≥ 1 sprint.
2. **Release N+1**: xoá field khỏi TS schema. drizzle-kit sinh `DROP COLUMN`. ĐỌC migration SQL. APPROVAL từ chủ project. Backup DB. Apply.
3. **Release N+2**: verify production ổn. Backup giữ ≥ 30 ngày.

Drop trực tiếp = mất data không rollback.

## drizzle-kit RENAME — đọc kỹ câu hỏi CLI

```
Is column 'fullName' a renamed of 'name'?
```
- **Yes** → `ALTER ... RENAME COLUMN`, giữ data.
- **No** → `DROP + ADD`, **MẤT DATA**.

→ Đọc 2 lần trước khi Enter.

## drizzle.config.ts

```ts
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",  // re-export folder
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,  // confirm trước khi drop
  verbose: true,
});
```

## Cấm

- ❌ `serial`/`uuid v4` PK (dùng ULID).
- ❌ `pgEnum` (dùng varchar + Zod).
- ❌ `timestamp` không có `withTimezone`.
- ❌ FK không có `onDelete`.
- ❌ FK không có index.
- ❌ `real`/`numeric` cho tiền (dùng `integer` cents).
- ❌ Drop column trực tiếp.
- ❌ Edit migration SQL bằng tay (drizzle-kit sinh).
- ❌ Sửa `src/db/schema/auth.ts` (CLI Better Auth sinh).

## Khi sửa file ở đây, MUST verify

- [ ] 1 file 1 bảng.
- [ ] Re-export trong `index.ts`.
- [ ] PK ULID 26 ký tự.
- [ ] FK có `onDelete` + index.
- [ ] Idempotency key có UNIQUE index.
- [ ] Tiền là `integer`.
- [ ] `bun run db:generate` thành công.
- [ ] ĐỌC SQL trong `drizzle/<ts>_*.sql` — không có DROP COLUMN ngoài ý muốn.
- [ ] `bun run db:migrate` thành công.
- [ ] `bun run db:studio` xác nhận bảng đúng.
