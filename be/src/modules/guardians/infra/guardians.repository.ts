// WHY: Query scoped theo OWNER ngay từ khung — trạng thái guardian chỉ chủ ví
// thấy (luật security.md #Quyền). JOIN wallets để assert ownership trong 1 query.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type Guardian, guardians } from "./guardians.schema";

const LIST_LIMIT = 100;

// Audit 2026-07-25 (§6.5): `status` lọc TRONG SQL. Lọc sau LIMIT ở handler làm
// `?status=active` trả rỗng khi 100 guardian mới nhất đều khác trạng thái đó —
// sai im lặng, không phải chậm.
export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  status?: string,
  limit = LIST_LIMIT,
): Promise<Guardian[]> {
  const scope = and(eq(guardians.walletId, walletId), eq(wallets.userId, ownerUserId));
  const rows = await db
    .select({ guardian: guardians })
    .from(guardians)
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    .where(status ? and(scope, eq(guardians.status, status)) : scope)
    .orderBy(desc(guardians.createdAt))
    .limit(limit);
  return rows.map((r) => r.guardian);
}
