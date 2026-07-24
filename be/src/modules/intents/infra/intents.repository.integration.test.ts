// Integration Postgres THẬT (pattern testing-be: pgReachable → skip nêu lý do).
// Phủ 2 cổng nghiệm thu 3.3:
//   A3 — 50 insert SONG SONG cùng (wallet, client_intent_id) → đúng MỘT bản ghi.
//   A4 — sweeper: intent + approval quá hạn → expired + audit; chưa hạn thì để yên.
import { afterAll, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { createIdempotent, sweepExpired } from "./intents.repository";
import { transactionIntents } from "./intents.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const USER = `it-user-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

async function makeWallet(): Promise<string> {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: USER,
      stellarAddress: `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "A")}`,
    })
    .returning({ id: wallets.id });
  if (!row) throw new Error("wallet insert failed");
  cleanupWalletIds.push(row.id);
  return row.id;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(auditLog).where(eq(auditLog.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn intents/approvals
  }
});

describe("intents repository (Postgres thật)", () => {
  testIt("A3: 50 request song song cùng client_intent_id → MỘT bản ghi", async () => {
    const walletId = await makeWallet();
    const clientIntentId = crypto.randomUUID();
    const input = {
      walletId,
      clientIntentId,
      createdBy: "owner" as const,
      operations: [{ type: "payment" }],
      recipient: null,
      amount: 1_000_000n,
    };

    const results = await Promise.all(Array.from({ length: 50 }, () => createIdempotent(input)));

    const freshInserts = results.filter((r) => !r.deduplicated);
    expect(freshInserts).toHaveLength(1);
    const ids = new Set(results.map((r) => r.intent.id));
    expect(ids.size).toBe(1);

    const rows = await db
      .select({ id: transactionIntents.id })
      .from(transactionIntents)
      .where(
        and(
          eq(transactionIntents.walletId, walletId),
          eq(transactionIntents.clientIntentId, clientIntentId),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  testIt("A4: sweeper chuyển intent quá hạn → expired + audit; intent còn hạn để yên", async () => {
    const walletId = await makeWallet();
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3_600_000);

    const mk = (clientId: string, expiresAt: Date, status = "draft") =>
      db
        .insert(transactionIntents)
        .values({
          walletId,
          clientIntentId: clientId,
          status,
          operations: [{ type: "payment" }],
          expiresAt,
        })
        .returning({ id: transactionIntents.id });

    const [expired] = await mk(crypto.randomUUID(), past);
    const [alive] = await mk(crypto.randomUUID(), future);
    const [waiting] = await mk(crypto.randomUUID(), past, "awaiting_guardian");
    if (!expired || !alive || !waiting) throw new Error("seed failed");

    const swept = await sweepExpired(new Date());
    expect(swept).toBeGreaterThanOrEqual(2);

    const byId = async (id: string) =>
      (
        await db
          .select({ status: transactionIntents.status })
          .from(transactionIntents)
          .where(eq(transactionIntents.id, id))
      )[0]?.status;
    expect(await byId(expired.id)).toBe("expired");
    expect(await byId(waiting.id)).toBe("expired");
    expect(await byId(alive.id)).toBe("draft");

    // Audit: mỗi intent hết hạn một dòng system.
    const audits = await db
      .select({ kind: auditLog.kind, actorType: auditLog.actorType })
      .from(auditLog)
      .where(eq(auditLog.walletId, walletId));
    expect(audits.filter((a) => a.kind === "intent.expired")).toHaveLength(2);
    expect(audits.every((a) => a.actorType === "system")).toBe(true);
  });
});
