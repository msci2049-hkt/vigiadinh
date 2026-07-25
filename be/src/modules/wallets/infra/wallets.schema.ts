// WHY: Bảng `wallets` — ví Stellar của user (1 user có thể nhiều ví).
// - user_id: SOFT REF tới user Better Auth (id text) — varchar(64) + index,
//   KHÔNG FK cứng (rule db-schema.md).
// - threshold/timelock_secs: mirror cấu hình on-chain (nguồn sự thật là contract;
//   đây là bản mirror để render nhanh — indexer đồng bộ).
// - CHECK thay enum (rule code-style.md).
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
import { families } from "./families.schema";

export const wallets = pgTable(
  "wallets",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    userId: varchar("user_id", { length: 64 }).notNull(),
    // PHA 3.1: ví thuộc một family (nullable — ví tạo trước khi lập family).
    familyId: varchar("family_id", { length: 26 }).references(() => families.id, {
      onDelete: "set null",
    }),
    // PHA 4.1: múi giờ chủ ví (IANA) — cron ping 12:00 CHẠY THEO GIỜ ĐỊA PHƯƠNG
    // của chủ ví. Default UTC (sản phẩm toàn cầu — không mặc định nước nào).
    timezone: varchar("timezone", { length: 40 }).notNull().default("UTC"),
    stellarAddress: varchar("stellar_address", { length: 56 }).notNull(),
    contractId: varchar("contract_id", { length: 56 }),
    threshold: integer("threshold").notNull().default(2),
    timelockSecs: integer("timelock_secs").notNull().default(86400),
    // Closeout 2026-07-25 §4 — SỐ HIỆU PHIÊN VÍ, để THU HỒI được JWT SEP-45.
    // Khoá cũ mất quyền on-chain ngay khi recovery xoay khoá, nhưng JWT đã phát
    // thì tự chứng (HS256 + exp) — không có nơi nào tra để chối nó. Tăng cột này
    // khi recovery hoàn tất là mọi JWT phát trước đó chết tức thì, vì `ver` trong
    // claims không còn khớp. Rẻ hơn nhiều so với danh sách đen từng token.
    jwtVersion: integer("jwt_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("wallets_user_id_idx").on(t.userId),
    familyIdx: index("wallets_family_id_idx").on(t.familyId),
    addressUq: uniqueIndex("wallets_stellar_address_uq").on(t.stellarAddress),
    thresholdCheck: check("wallets_threshold_check", sql`${t.threshold} >= 1`),
    timelockCheck: check("wallets_timelock_check", sql`${t.timelockSecs} >= 0`),
  }),
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
