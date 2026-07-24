// WHY: Bảng `approval_requests` — phiếu duyệt của guardian cho MỘT phiên bản intent
// (PHA 3.1, schema chuẩn skill vi-backend-pipeline §3).
// - challenge_hash = H(intent_hash ‖ amount ‖ recipient ‖ policy_version ‖ expires_at)
//   (K5): server tính lại từ intent HIỆN TẠI khi xác nhận — lệch là từ chối →
//   "approved=true tái dùng" chết tự nhiên; sửa amount (P4) cũng làm hash lệch.
// - verified_call: checkbox "đã gọi xác minh" — BẮT BUỘC khi risk ≥ ngưỡng (service enforce).
// - guardian_device_id: SOFT REF devices (thiết bị đã bấm duyệt — audit trail).
// - unique (intent, guardian, version): một guardian một phiếu cho mỗi phiên bản.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { guardians } from "../../guardians/infra/guardians.schema";
import { transactionIntents } from "./intents.schema";

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    intentId: varchar("intent_id", { length: 26 })
      .notNull()
      .references(() => transactionIntents.id, { onDelete: "cascade" }),
    intentVersion: integer("intent_version").notNull(),
    guardianId: varchar("guardian_id", { length: 26 })
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    guardianDeviceId: varchar("guardian_device_id", { length: 26 }),
    challengeHash: varchar("challenge_hash", { length: 64 }).notNull(),
    verifiedCall: boolean("verified_call").notNull().default(false),
    decision: varchar("decision", { length: 16 }).notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    intentIdx: index("approval_requests_intent_id_idx").on(t.intentId),
    guardianIdx: index("approval_requests_guardian_id_idx").on(t.guardianId),
    expiresIdx: index("approval_requests_expires_at_idx").on(t.expiresAt),
    perVersionUq: uniqueIndex("approval_requests_intent_guardian_version_uq").on(
      t.intentId,
      t.guardianId,
      t.intentVersion,
    ),
    decisionCheck: check(
      "approval_requests_decision_check",
      sql`${t.decision} IN ('pending','approved','rejected','expired')`,
    ),
    versionCheck: check("approval_requests_version_check", sql`${t.intentVersion} >= 1`),
  }),
);

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
