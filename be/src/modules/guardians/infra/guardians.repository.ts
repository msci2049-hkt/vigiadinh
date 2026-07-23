// WHY: Query scoped theo OWNER ngay từ khung — trạng thái guardian chỉ chủ ví
// thấy (luật security.md #Quyền). JOIN wallets để assert ownership trong 1 query.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type Guardian, guardians } from "./guardians.schema";

const LIST_LIMIT = 100;

export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
): Promise<Guardian[]> {
  const rows = await db
    .select({ guardian: guardians })
    .from(guardians)
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    .where(and(eq(guardians.walletId, walletId), eq(wallets.userId, ownerUserId)))
    .orderBy(desc(guardians.createdAt))
    .limit(limit);
  return rows.map((r) => r.guardian);
}
