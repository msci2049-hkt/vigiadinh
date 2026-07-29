// WHY: Bảng `wallet_policies` — NGƯỠNG MỀM chi tiêu do chủ ví tự cài (per-tx +
// daily, stroops). Chọn bảng riêng thay vì cột trên `wallets` vì timelock nâng
// ngưỡng cần HAI bản ghi sống cùng lúc (active đang hiệu lực + pending chờ 24h)
// — cột đơn không chở được; một bảng giải cả A1 lẫn B2 trong MỘT migration.
// - Trần cứng thật nằm ON-CHAIN (spending-limit policy rule 0) — bảng này chỉ
//   là gate UX ở BE, kẻ chiếm DB không rút quá trần on-chain được.
// - status CHECK thay enum (rule db-schema.md); tiền bigint stroops (i128 phía
//   chain nhưng ngưỡng người dùng ≤ 20k XLM nên bigint Postgres dư sức).
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "./wallets.schema";

export const walletPolicies = pgTable(
  "wallet_policies",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    perTxLimit: bigint("per_tx_limit", { mode: "bigint" }).notNull(),
    dailyLimit: bigint("daily_limit", { mode: "bigint" }).notNull(),
    version: integer("version").notNull(),
    // active: đang hiệu lực · pending: nâng ngưỡng chờ 24h · cancelled: chủ ví
    // huỷ đề nghị · superseded: bị bản mới thay.
    status: varchar("status", { length: 16 }).notNull().default("active"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    createdBy: varchar("created_by", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("wallet_policies_wallet_id_idx").on(t.walletId),
    versionUq: uniqueIndex("wallet_policies_wallet_version_uq").on(t.walletId, t.version),
    // Mỗi ví TỐI ĐA một active + một pending — ràng ở DB, không tin service.
    activeUq: uniqueIndex("wallet_policies_wallet_active_uq")
      .on(t.walletId)
      .where(sql`status = 'active'`),
    pendingUq: uniqueIndex("wallet_policies_wallet_pending_uq")
      .on(t.walletId)
      .where(sql`status = 'pending'`),
    statusCheck: check(
      "wallet_policies_status_check",
      sql`${t.status} IN ('active','pending','cancelled','superseded')`,
    ),
    limitsCheck: check(
      "wallet_policies_limits_check",
      sql`${t.perTxLimit} > 0 AND ${t.dailyLimit} >= ${t.perTxLimit}`,
    ),
  }),
);

export type WalletPolicy = typeof walletPolicies.$inferSelect;
export type NewWalletPolicy = typeof walletPolicies.$inferInsert;
