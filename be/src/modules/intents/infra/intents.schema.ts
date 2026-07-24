// WHY: Bảng `transaction_intents` — trục xương sống MỌI luồng tiền (PHA 3, skill
// vi-backend-pipeline §1-3). Trạng thái theo shared/intent.ts (13 state, copy
// AUTO-SYNC ở src/shared-contract/intent.ts) — CHECK thay enum (rule db-schema).
// - client_intent_id: idempotency key CLIENT sinh (A3) — unique THEO VÍ; POST lặp
//   cùng id trả bản ghi cũ, không tạo mới.
// - version: P4 — sửa amount/recipient sau approval ⇒ version mới, approval cũ
//   (bind challenge_hash) tự vô hiệu.
// - amount: bigint STROOPS (i64 Stellar; rule "tiền là integer" — stroops là
//   đơn vị nguyên nhỏ nhất). Nullable: intent đổi cấu hình không có số tiền.
// - intent_hash: hash canonical (service tính) — đầu vào challenge_hash (K5).
// - expires_at + index: sweeper BullMQ quét TTL (A4 — draft 24h).
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const transactionIntents = pgTable(
  "transaction_intents",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    clientIntentId: varchar("client_intent_id", { length: 64 }).notNull(),
    version: integer("version").notNull().default(1),
    // Ai tạo draft — AI chỉ được create_draft/request_clarify (P2, luật "AI nhìn không cầm").
    createdBy: varchar("created_by", { length: 16 }).notNull().default("owner"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    // Danh sách operation Stellar dạng khai báo (client build tx từ đây khi ký).
    operations: jsonb("operations").notNull(),
    recipient: varchar("recipient", { length: 56 }),
    amount: bigint("amount", { mode: "bigint" }),
    intentHash: varchar("intent_hash", { length: 64 }),
    policyDecision: varchar("policy_decision", { length: 20 }),
    policyVersion: integer("policy_version"),
    policyReasons: jsonb("policy_reasons"),
    riskContext: jsonb("risk_context"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("transaction_intents_wallet_id_idx").on(t.walletId),
    statusIdx: index("transaction_intents_status_idx").on(t.status),
    expiresIdx: index("transaction_intents_expires_at_idx").on(t.expiresAt),
    clientIdUq: uniqueIndex("transaction_intents_wallet_client_uq").on(
      t.walletId,
      t.clientIntentId,
    ),
    statusCheck: check(
      "transaction_intents_status_check",
      sql`${t.status} IN ('draft','validating','review','policy_gate','awaiting_guardian','approved','awaiting_signature','submitting','settled','rejected','expired','cancelled','submit_failed')`,
    ),
    createdByCheck: check(
      "transaction_intents_created_by_check",
      sql`${t.createdBy} IN ('owner','ai')`,
    ),
    decisionCheck: check(
      "transaction_intents_decision_check",
      sql`${t.policyDecision} IS NULL OR ${t.policyDecision} IN ('allow','require_guardian','delay')`,
    ),
    amountCheck: check(
      "transaction_intents_amount_check",
      sql`${t.amount} IS NULL OR ${t.amount} > 0`,
    ),
    versionCheck: check("transaction_intents_version_check", sql`${t.version} >= 1`),
  }),
);

export type TransactionIntent = typeof transactionIntents.$inferSelect;
export type NewTransactionIntent = typeof transactionIntents.$inferInsert;
