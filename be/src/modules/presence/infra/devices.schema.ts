// WHY: Bảng `devices` — máy đã đăng ký nhận silent push (chủ ví + guardian).
// owner_id: SOFT REF user Better Auth. kind: CHECK thay enum.
// push_token/fingerprint_hash: nullable — đăng ký trước, gắn token sau.
import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const devices = pgTable(
  "devices",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    ownerId: varchar("owner_id", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    platform: varchar("platform", { length: 32 }),
    pushToken: varchar("push_token", { length: 512 }),
    fingerprintHash: varchar("fingerprint_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("devices_owner_id_idx").on(t.ownerId),
    kindCheck: check("devices_kind_check", sql`${t.kind} IN ('owner','guardian')`),
  }),
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
