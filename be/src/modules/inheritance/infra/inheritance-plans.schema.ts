// WHY: Bảng `inheritance_plans` — kế hoạch thừa kế của một ví (PHA 3.1, entity #7).
// Tỷ lệ chia nằm ở `heirs` (bps); bảng này giữ THAM SỐ chu trình: im lặng bao lâu
// thì mở claim (inactivity_period) + timelock cuối trước execute (final_timelock).
// version: đổi kế hoạch = version mới (mirror versioning on-chain, không UPDATE đè
// lịch sử). MỘT bản ghi active mỗi (wallet, version) — unique index.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const inheritancePlans = pgTable(
  "inheritance_plans",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    // Giây im lặng (không heartbeat) trước khi guardian ĐƯỢC GỢI Ý mở claim —
    // server chỉ gợi ý, mở claim là hành động on-chain của guardian (bất biến 2).
    inactivityPeriodSecs: integer("inactivity_period_secs").notNull().default(2_592_000),
    // Timelock cuối sau claim, trước execute — cửa sổ veto của owner.
    finalTimelockSecs: integer("final_timelock_secs").notNull().default(604_800),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    // PHA 4.3: bậc leo thang heartbeat hiện tại (0 khoẻ → 3 gợi ý claim).
    // Chỉ tăng khi sweep thấy im lặng thêm kỳ; heartbeat của owner reset về 0.
    // Notify CHỈ bắn khi tier TĂNG — đó là debounce.
    escalationTier: integer("escalation_tier").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("inheritance_plans_wallet_id_idx").on(t.walletId),
    perVersionUq: uniqueIndex("inheritance_plans_wallet_version_uq").on(t.walletId, t.version),
    statusCheck: check(
      "inheritance_plans_status_check",
      sql`${t.status} IN ('draft','active','revoked')`,
    ),
    inactivityCheck: check(
      "inheritance_plans_inactivity_check",
      sql`${t.inactivityPeriodSecs} >= 86400`,
    ),
    timelockCheck: check("inheritance_plans_timelock_check", sql`${t.finalTimelockSecs} >= 3600`),
    versionCheck: check("inheritance_plans_version_check", sql`${t.version} >= 1`),
  }),
);

export type InheritancePlan = typeof inheritancePlans.$inferSelect;
export type NewInheritancePlan = typeof inheritancePlans.$inferInsert;
