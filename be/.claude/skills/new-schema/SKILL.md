# SKILL: Tạo bảng Drizzle mới

## Dùng khi nào

- Tạo bảng mới trong Postgres qua Drizzle.
- Thêm cột vào bảng có sẵn.
- Thêm index, foreign key, constraint.
- **KHÔNG** dùng khi drop column → cần approval (xem ERRORS.md mục "Drop column").

---

## Thứ tự làm

```
1. Đọc .claude/CODE_BASE_MAP.md
   → Bảng đã tồn tại chưa?

2. Tạo file src/db/schema/<tên-bảng>.ts
   → 1 file = 1 bảng. KHÔNG nhét nhiều bảng vào 1 file.

3. Re-export trong src/db/schema/index.ts:
   export * from "./<tên-bảng>";

4. Chạy bun run db:generate
   → ĐỌC file SQL sinh ra trong drizzle/. Có DROP COLUMN nào lén lút không?

5. Apply: bun run db:migrate

6. Verify bằng drizzle-kit studio (mở browser xem bảng).

7. Cập nhật .claude/CODE_BASE_MAP.md.
```

---

## File tạo ở đâu

- Bảng của domain: `src/db/schema/<tên-bảng>.ts`
- Migration: `drizzle/<timestamp>_<name>.sql` (drizzle-kit auto-sinh, **KHÔNG sửa tay**)

---

## Code mẫu

### Bảng cơ bản với ULID

```ts
/**
 * Bảng `users` — thông tin user.
 * - id: ULID 26 ký tự (sortable theo time, btree không fragment).
 * - email: unique, lowercase enforce ở app layer.
 * - passwordHash: argon2id qua Bun.password, KHÔNG plain text.
 */
import { pgTable, varchar, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Index isActive vì query "user đang hoạt động" hay dùng.
    // Email đã có unique index tự động.
    activeIdx: index("users_active_idx").on(t.isActive),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### Bảng có foreign key

```ts
/**
 * Bảng `wallets` — ví của user. 1 user có thể có nhiều ví.
 * - userId: FK đến users.id, onDelete 'restrict' tránh xoá user còn ví.
 */
import { pgTable, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { users } from "./users";

export const wallets = pgTable(
  "wallets",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    userId: varchar("user_id", { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    balance: integer("balance").notNull().default(0), // cents
    currency: varchar("currency", { length: 3 }).notNull().default("VND"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("wallets_user_id_idx").on(t.userId),
  }),
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
```

### Bảng có "enum" (dùng varchar + Zod, KHÔNG pgEnum)

```ts
// LÝ DO không dùng pgEnum: thêm value phải ALTER TYPE rất phiền,
// không rollback dễ. varchar + validate ở Zod linh hoạt hơn.
status: varchar("status", { length: 16 }).notNull().default("pending"),
// Ở dto.ts:
// status: z.enum(["pending", "success", "failed"])
```

### Bảng append-only (audit log)

```ts
/**
 * Bảng `audit_logs` — ghi mọi thay đổi quan trọng.
 * - Append-only. KHÔNG update/delete record (enforce ở app layer).
 * - Index theo entityType + entityId để tra cứu nhanh.
 */
import { pgTable, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 26 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(), // create/update/delete
    actorId: varchar("actor_id", { length: 26 }), // null nếu là system
    diff: jsonb("diff"), // before/after JSON
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    actorIdx: index("audit_logs_actor_idx").on(t.actorId),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

### Bảng có composite unique (idempotency)

```ts
/**
 * Bảng `webhook_events` — dedup webhook từ provider.
 * - (provider, external_id) UNIQUE → INSERT lần 2 sẽ throw 23505.
 *   Route handler bắt 23505 → trả 200 deduplicated.
 */
import { pgTable, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupUq: uniqueIndex("webhook_events_provider_extid_uq").on(t.provider, t.externalId),
  }),
);
```

---

## drizzle.config.ts (thiết lập 1 lần)

```ts
import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts", // <-- re-export folder
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  // strict mode: bắt buộc xác nhận trước khi drop column / table.
  strict: true,
  verbose: true,
});
```

---

## src/db/index.ts (Drizzle client)

```ts
/**
 * Drizzle client + postgres connection pool.
 * - max: 20 connection cho 1 instance. Scale qua env nếu cần.
 * - prepare: false để tránh prepared statement bind với pool transient.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/env";
import * as schema from "./schema";

const pool = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: 30,
  prepare: false,
});

export const db = drizzle(pool, { schema });
```

---

## Checklist cuối

- [ ] 1 file = 1 bảng trong `src/db/schema/`.
- [ ] Re-export trong `src/db/schema/index.ts`.
- [ ] Comment đầu file giải thích bảng làm gì.
- [ ] Đặt index cho FK + cột query thường xuyên.
- [ ] Đặt unique constraint cho idempotency key (nếu có).
- [ ] `bun run db:generate` thành công, đã ĐỌC file SQL sinh ra.
- [ ] KHÔNG có `DROP COLUMN` / `DROP TABLE` trong migration mới.
- [ ] `bun run db:migrate` thành công.
- [ ] `bun run db:studio` mở được, thấy bảng đúng.
- [ ] Cập nhật `.claude/CODE_BASE_MAP.md`.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `bun run db:generate` không tạo file mới | Schema chưa re-export trong index.ts | Thêm `export * from "./<bảng>";` |
| Migration báo "column does not exist" khi rollback | Drizzle-kit không rollback. | KHÔNG drop. Hoặc viết SQL down thủ công + test trên staging. |
| FK báo "violates foreign key constraint" | Insert wallet trước khi user tồn tại | Đảm bảo thứ tự insert, hoặc đổi onDelete 'cascade'. |
| ULID không sinh tự động | Quên `$defaultFn(() => ulid())` | Thêm vào column. |
| Timezone lệch | Dùng `timestamp` không có `withTimezone: true` | Luôn `{ withTimezone: true }`. |
| Index không được dùng | Query không match index column order | `EXPLAIN ANALYZE` query, sửa index. |
