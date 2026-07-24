// WHY: Bảng `families` — nhóm gia đình (PHA 3.1, checklist entity #1).
// Một family có thể có nhiều ví (wallets.family_id trỏ về đây). Thành viên
// KHÔNG có bảng riêng — quan hệ đi qua guardians/heirs của từng ví (checklist:
// PrivateMessage OUT M9, không dựng bảng xã hội).
// owner_user_id: SOFT REF user Better Auth (rule db-schema.md).
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const families = pgTable(
  "families",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    name: varchar("name", { length: 120 }).notNull(),
    ownerUserId: varchar("owner_user_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("families_owner_user_id_idx").on(t.ownerUserId),
  }),
);

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
