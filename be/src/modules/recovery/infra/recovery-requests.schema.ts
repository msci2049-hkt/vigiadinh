// WHY: Bảng `recovery_requests` — mirror yêu cầu khôi phục on-chain
// (nguồn sự thật = Recovery Registry contract; indexer đồng bộ).
// signals: jsonb — tín hiệu risk engine chấm (fw-ai-night-watch).
// status CHECK: giá trị KHỞI TẠO cho khung — chốt lại khi nối indexer thật.
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const recoveryRequests = pgTable(
  "recovery_requests",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    newOwner: varchar("new_owner", { length: 56 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    riskScore: integer("risk_score"),
    signals: jsonb("signals"),
    txHash: varchar("tx_hash", { length: 64 }),
    // PHA 3.1 (checklist entity #5) — additive nullable/default (forward-only):
    // Bằng chứng thiết bị mới (attestation passkey mới + metadata) — người mất máy
    // chứng minh "tôi là tôi" trên máy mới; guardian xem trước khi duyệt.
    newDeviceProof: jsonb("new_device_proof"),
    // Mirror đếm phiếu on-chain (nguồn sự thật = contract; indexer đồng bộ).
    approvals: integer("approvals").notNull().default(0),
    threshold: integer("threshold"),
    // Cửa sổ veto: owner cũ chặn được tới thời điểm này (kênh ngoài app vẫn veto được).
    vetoUntil: timestamp("veto_until", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    walletIdx: index("recovery_requests_wallet_id_idx").on(t.walletId),
    statusIdx: index("recovery_requests_status_idx").on(t.status),
    statusCheck: check(
      "recovery_requests_status_check",
      sql`${t.status} IN ('pending','ready','executed','vetoed','expired')`,
    ),
    riskCheck: check(
      "recovery_requests_risk_check",
      sql`${t.riskScore} IS NULL OR (${t.riskScore} >= 0 AND ${t.riskScore} <= 100)`,
    ),
    approvalsCheck: check("recovery_requests_approvals_check", sql`${t.approvals} >= 0`),
    thresholdCheck: check(
      "recovery_requests_threshold_check",
      sql`${t.threshold} IS NULL OR ${t.threshold} >= 1`,
    ),
  }),
);

export type RecoveryRequest = typeof recoveryRequests.$inferSelect;
export type NewRecoveryRequest = typeof recoveryRequests.$inferInsert;
