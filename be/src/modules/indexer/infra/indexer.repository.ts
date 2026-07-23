import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type AuditEntry, auditLog, type NewAuditEntry } from "./audit-log.schema";

const LIST_LIMIT = 100;

export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
): Promise<AuditEntry[]> {
  const rows = await db
    .select({ entry: auditLog })
    .from(auditLog)
    .innerJoin(wallets, eq(auditLog.walletId, wallets.id))
    .where(and(eq(auditLog.walletId, walletId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(auditLog.at))
    .limit(limit);
  return rows.map((r) => r.entry);
}

export async function append(data: NewAuditEntry): Promise<AuditEntry> {
  const [row] = await db.insert(auditLog).values(data).returning();
  if (!row) throw new Error("AUDIT_APPEND_FAILED");
  return row;
}
