import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type Heir, heirs } from "./heirs.schema";
import { type InheritancePlan, inheritancePlans } from "./inheritance-plans.schema";

const LIST_LIMIT = 100;

/**
 * Kế hoạch thừa kế MỚI NHẤT của một ví (owner-scoped): ưu tiên bản active, không
 * thì bản version cao nhất. Chỉ TRẢ tham số chu trình (im lặng bao lâu, timelock
 * cuối, bậc leo thang) — mở claim vẫn là hành động on-chain của guardian (bất biến 2).
 */
export async function getLatestPlanForOwner(
  walletId: string,
  ownerUserId: string,
): Promise<InheritancePlan | null> {
  const rows = await db
    .select({ plan: inheritancePlans })
    .from(inheritancePlans)
    .innerJoin(wallets, eq(inheritancePlans.walletId, wallets.id))
    .where(and(eq(inheritancePlans.walletId, walletId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(inheritancePlans.version));
  if (rows.length === 0) return null;
  const active = rows.find((r) => r.plan.status === "active");
  return (active ?? rows[0])?.plan ?? null;
}

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
