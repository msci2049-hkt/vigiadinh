import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type RecoveryRequest, recoveryRequests } from "./recovery-requests.schema";

const LIST_LIMIT = 100;

export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
): Promise<RecoveryRequest[]> {
  const rows = await db
    .select({ request: recoveryRequests })
    .from(recoveryRequests)
    .innerJoin(wallets, eq(recoveryRequests.walletId, wallets.id))
    .where(and(eq(recoveryRequests.walletId, walletId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(recoveryRequests.startedAt))
    .limit(limit);
  return rows.map((r) => r.request);
}
