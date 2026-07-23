// WHY: Bảng `audit_log` — nhật ký sự kiện (on-chain event mirror + hành động hệ
// thống). APPEND-ONLY. wallet_id: SOFT REF (varchar + index, KHÔNG FK) — log
// phải sống lâu hơn ví (audit sau khi ví xóa vẫn đọc được).
// Checkpoint getEvents (RPC chỉ giữ ~7 ngày — rule stellar.md) thêm bảng riêng
// khi dựng indexer thật (skill fw-indexer-notify).
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const auditLog = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 }).notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("audit_log_wallet_id_idx").on(t.walletId),
    kindIdx: index("audit_log_kind_idx").on(t.kind),
  }),
);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
