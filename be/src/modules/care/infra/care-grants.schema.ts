// WHY: Bảng `care_grants` — quyền chăm sóc giới hạn (PHA 3.1, checklist entity #6):
// con cái/người thân được chi TRONG hạn mức + allowlist người nhận, thu hồi được.
// Đây là mirror cấu hình policy on-chain (spending limit + allowlist cắm vào
// context rule của smart account) — nguồn sự thật là contract, bảng này để render
// nhanh + đối chiếu. Module `care` mới chỉ có tầng schema; routes dựng PHA sau.
// - limits: bigint STROOPS (tiền = integer, rule db-schema).
// - grantee_ref: user id hoặc địa chỉ Stellar (như heirs.heir_ref).
// - revoked_at: thu hồi là SOFT — giữ dòng làm lịch sử, service lọc revoked IS NULL.
import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const careGrants = pgTable(
  "care_grants",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    granteeRef: varchar("grantee_ref", { length: 64 }).notNull(),
    dailyLimit: bigint("daily_limit", { mode: "bigint" }).notNull(),
    totalLimit: bigint("total_limit", { mode: "bigint" }),
    recipientAllowlist: jsonb("recipient_allowlist").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("care_grants_wallet_id_idx").on(t.walletId),
    granteeIdx: index("care_grants_grantee_ref_idx").on(t.granteeRef),
    dailyCheck: check("care_grants_daily_check", sql`${t.dailyLimit} > 0`),
    totalCheck: check(
      "care_grants_total_check",
      sql`${t.totalLimit} IS NULL OR ${t.totalLimit} >= ${t.dailyLimit}`,
    ),
  }),
);

export type CareGrant = typeof careGrants.$inferSelect;
export type NewCareGrant = typeof careGrants.$inferInsert;
