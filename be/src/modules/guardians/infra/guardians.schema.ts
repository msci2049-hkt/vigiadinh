// WHY: Bảng `guardians` — người bảo hộ của một ví.
// - wallet_id: FK CỨNG (2 bảng tự viết) + onDelete cascade + index.
// - user_id: SOFT REF user Better Auth — nullable: mời qua email/link trước,
//   gán user khi người bảo hộ nhận lời.
// - status: CHECK thay enum — thang trạng thái presence (skill fw-guardian-presence).
// - Import schema xuyên module bằng đường dẫn TƯƠNG ĐỐI: ngoại lệ có chủ đích
//   cho TẦNG SCHEMA (FK cần table object; db/schema/index.ts gom tất cả).
import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const guardians = pgTable(
  "guardians",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }),
    onchainKey: varchar("onchain_key", { length: 56 }),
    status: varchar("status", { length: 16 }).notNull().default("invited"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastManualConfirmAt: timestamp("last_manual_confirm_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("guardians_wallet_id_idx").on(t.walletId),
    userIdx: index("guardians_user_id_idx").on(t.userId),
    statusCheck: check(
      "guardians_status_check",
      sql`${t.status} IN ('invited','active','slow','offline','removed')`,
    ),
  }),
);

export type Guardian = typeof guardians.$inferSelect;
export type NewGuardian = typeof guardians.$inferInsert;
