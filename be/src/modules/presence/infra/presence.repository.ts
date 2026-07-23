// WHY: Ping của guardian chỉ CHỦ VÍ thấy — join guardians→wallets assert owner.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "../../guardians/infra/guardians.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type PresencePing, presencePings } from "./presence-pings.schema";

const LIST_LIMIT = 100;

export async function listPingsByGuardianForOwner(
  guardianId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
): Promise<PresencePing[]> {
  const rows = await db
    .select({ ping: presencePings })
    .from(presencePings)
    .innerJoin(guardians, eq(presencePings.guardianId, guardians.id))
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    .where(and(eq(presencePings.guardianId, guardianId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(presencePings.sentAt))
    .limit(limit);
  return rows.map((r) => r.ping);
}
