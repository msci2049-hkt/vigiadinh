// Repository transaction_intents (PHA 3.3) — idempotency ở TẦNG DB (A3):
// unique (wallet_id, client_intent_id); INSERT đụng 23505 → SELECT bản cũ trả về.
// Đây là chốt đúng cho 50 request song song (Redis NX chỉ là guard phụ cho
// double-tap KÝ ở PHA 5 — không thay được unique index).
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { computeIntentHash } from "../domain/hashing";
import { DRAFT_TTL_SECONDS, expiresAtFrom } from "../domain/ttl";
import { approvalRequests } from "./approvals.schema";
import {
  type NewTransactionIntent,
  type TransactionIntent,
  transactionIntents,
} from "./intents.schema";

const PG_UNIQUE_VIOLATION = "23505";

// Drizzle bọc PostgresError — mã 23xxx nằm trong chuỗi err.cause, không phải
// top-level (cùng lý do test-support/pg.ts có helper riêng cho test).
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if ((cur as { code?: unknown }).code === PG_UNIQUE_VIOLATION) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** Ví thuộc user không (ownership — route đã requireAuth, đây là lớp 2). */
export async function walletOwnedBy(walletId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)))
    .limit(1);
  return rows.length === 1;
}

export type CreateIntentInput = {
  walletId: string;
  clientIntentId: string;
  createdBy: "owner" | "ai";
  operations: unknown;
  recipient: string | null;
  amount: bigint | null;
};

/** Insert idempotent: lần 2+ cùng (wallet, client_intent_id) trả bản ghi CŨ. */
export async function createIdempotent(
  input: CreateIntentInput,
): Promise<{ intent: TransactionIntent; deduplicated: boolean }> {
  const now = new Date();
  const values: NewTransactionIntent = {
    walletId: input.walletId,
    clientIntentId: input.clientIntentId,
    createdBy: input.createdBy,
    status: "draft",
    operations: input.operations,
    recipient: input.recipient,
    amount: input.amount,
    intentHash: computeIntentHash({
      walletId: input.walletId,
      version: 1,
      operations: input.operations,
      recipient: input.recipient,
      amount: input.amount,
    }),
    expiresAt: expiresAtFrom(now, DRAFT_TTL_SECONDS),
  };
  try {
    const [row] = await db.insert(transactionIntents).values(values).returning();
    if (!row) throw new Error("INTENT_INSERT_FAILED");
    return { intent: row, deduplicated: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [existing] = await db
      .select()
      .from(transactionIntents)
      .where(
        and(
          eq(transactionIntents.walletId, input.walletId),
          eq(transactionIntents.clientIntentId, input.clientIntentId),
        ),
      )
      .limit(1);
    if (!existing) throw err;
    return { intent: existing, deduplicated: true };
  }
}

/** Các state có đường system.expire trong bảng state machine — giữ ĐỒNG BỘ với
 * modules/intents/domain/state-machine.ts (có test khoá bên sweeper.test). */
export const SWEEPABLE_STATES = [
  "draft",
  "review",
  "awaiting_guardian",
  "approved",
  "awaiting_signature",
] as const;

/** Quét TTL (A4): mọi intent quá expires_at ở state quét được → expired.
 * Mỗi intent hết hạn ghi MỘT dòng audit (actor system) — cùng transaction. */
export async function sweepExpired(now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(transactionIntents)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          inArray(transactionIntents.status, [...SWEEPABLE_STATES]),
          lt(transactionIntents.expiresAt, now),
        ),
      )
      .returning({ id: transactionIntents.id, walletId: transactionIntents.walletId });
    if (expired.length > 0) {
      await tx.insert(auditLog).values(
        expired.map((row) => ({
          walletId: row.walletId,
          kind: "intent.expired",
          actorType: "system",
          payload: { intentId: row.id },
        })),
      );
    }
    // approval_requests pending quá hạn → expired (cùng lượt quét).
    await tx
      .update(approvalRequests)
      .set({ decision: "expired" })
      .where(and(eq(approvalRequests.decision, "pending"), lt(approvalRequests.expiresAt, now)));
    return expired.length;
  });
}
