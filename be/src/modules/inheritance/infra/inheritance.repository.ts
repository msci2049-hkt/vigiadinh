import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type Heir, heirs } from "./heirs.schema";

const LIST_LIMIT = 100;

export async function listHeirsByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
): Promise<Heir[]> {
  const rows = await db
    .select({ heir: heirs })
    .from(heirs)
    .innerJoin(wallets, eq(heirs.walletId, wallets.id))
    .where(and(eq(heirs.walletId, walletId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(heirs.bps))
    .limit(limit);
  return rows.map((r) => r.heir);
}

// Tổng bps của một ví — service dùng để enforce tổng = 10000 khi set heirs.
export function sumBps(items: Pick<Heir, "bps">[]): number {
  return items.reduce((acc, h) => acc + h.bps, 0);
}
