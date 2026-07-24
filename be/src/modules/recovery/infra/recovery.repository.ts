import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "../../guardians/infra/guardians.schema";
// Ngoại lệ TẦNG SCHEMA có chủ đích (như intents.repository): audit ghi cùng nơi.
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { type Wallet, wallets } from "../../wallets/infra/wallets.schema";
import { type RecoveryRequest, recoveryRequests } from "./recovery-requests.schema";

const LIST_LIMIT = 100;

export async function walletById(walletId: string): Promise<Wallet | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  return row ?? null;
}

/** Guardian ĐANG HIỆU LỰC (chưa removed) của ví, gắn với user đang đăng nhập. */
export async function guardianOfWalletForUser(
  walletId: string,
  userId: string,
): Promise<{ id: string; onchainKey: string | null } | null> {
  const [row] = await db
    .select({ id: guardians.id, onchainKey: guardians.onchainKey })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        eq(guardians.userId, userId),
        ne(guardians.status, "removed"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Khoá on-chain của MỌI guardian hiệu lực — cho register_wallet. */
export async function activeGuardianKeys(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ onchainKey: guardians.onchainKey })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        ne(guardians.status, "removed"),
        isNotNull(guardians.onchainKey),
      ),
    );
  return rows.map((r) => r.onchainKey).filter((k): k is string => k !== null);
}

/** Audit hành động on-chain do NGƯỜI làm (mirror trạng thái là việc của indexer). */
export async function appendOnchainAudit(entry: {
  walletId: string;
  kind: string;
  actorType: "owner" | "guardian";
  actorId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values(entry);
}

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
