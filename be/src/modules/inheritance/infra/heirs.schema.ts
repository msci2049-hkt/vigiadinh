// WHY: Bảng `heirs` — người thừa kế + tỷ lệ chia (basis points, 10000 = 100%).
// RÀNG BUỘC tổng bps = 10000 nằm ở TẦNG SERVICE (khi có feature set-heirs) —
// CHECK per-row chỉ chặn 0..10000.
// heir_ref: tham chiếu người nhận (địa chỉ Stellar hoặc user id) — chốt định
// dạng khi làm logic thật.
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const heirs = pgTable(
  "heirs",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    heirRef: varchar("heir_ref", { length: 64 }).notNull(),
    bps: integer("bps").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("heirs_wallet_id_idx").on(t.walletId),
    bpsCheck: check("heirs_bps_check", sql`${t.bps} BETWEEN 0 AND 10000`),
  }),
);

export type Heir = typeof heirs.$inferSelect;
export type NewHeir = typeof heirs.$inferInsert;
