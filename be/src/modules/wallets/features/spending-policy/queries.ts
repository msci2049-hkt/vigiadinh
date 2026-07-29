// Query đích thông báo cho luồng đổi ngưỡng — khuôn approvals.repository bên
// intents. Import schema guardians xuyên module = ngoại lệ có chủ đích cho TẦNG
// SCHEMA (như intents.repository đã làm với auditLog/wallets).
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../infra/wallets.schema";

/** userId chủ ví — đích email cảnh báo nâng ngưỡng (B4). */
export async function ownerUserId(walletId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row?.userId ?? null;
}

/** userId các guardian hiệu lực — lớp mắt thứ hai khi có đề nghị nâng (B9). */
export async function guardianUserIds(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: guardians.userId })
    .from(guardians)
    .where(and(eq(guardians.walletId, walletId), sql`${guardians.status} != 'removed'`));
  return [...new Set(rows.map((r) => r.userId).filter((u): u is string => Boolean(u)))];
}
