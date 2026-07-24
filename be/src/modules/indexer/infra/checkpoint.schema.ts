// WHY: 2 bảng xương sống indexer (PHA 4.2, skill fw-indexer-notify + pipeline §4).
// - indexer_checkpoint: RPC chỉ giữ ~7 ngày event (rule stellar.md) → cursor +
//   ledger_seq cập nhật MỖI batch; restart đọc từ đây chạy tiếp, không đoán.
//   PK = stream key ("default" cho cụm contract chính — thêm stream khi tách).
// - indexer_events: dedupe theo EVENT ID DUY NHẤT của RPC (giữa các trang có thể
//   trả trùng) — PK conflict = đã xử lý, bỏ qua. Append-only theo nghĩa thực
//   dụng (chỉ INSERT từ code), không trigger vì đây là bảng máy, audit mới là hồ sơ.
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const indexerCheckpoint = pgTable("indexer_checkpoint", {
  id: varchar("id", { length: 32 }).primaryKey(),
  cursor: varchar("cursor", { length: 128 }),
  ledgerSeq: integer("ledger_seq").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indexerEvents = pgTable(
  "indexer_events",
  {
    /** Event id từ RPC — duy nhất toàn mạng, chính là khoá dedupe. */
    id: varchar("id", { length: 128 }).primaryKey(),
    ledger: integer("ledger").notNull(),
    contractId: varchar("contract_id", { length: 56 }).notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contractIdx: index("indexer_events_contract_id_idx").on(t.contractId),
    ledgerIdx: index("indexer_events_ledger_idx").on(t.ledger),
  }),
);

export type IndexerCheckpoint = typeof indexerCheckpoint.$inferSelect;
export type IndexerEvent = typeof indexerEvents.$inferSelect;
