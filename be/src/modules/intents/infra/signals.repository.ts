// Tín hiệu rủi ro quanh MỘT lệnh chuyển (lô R2) — thuần SQL, deterministic,
// KHÔNG LLM. Tách file theo trần 300 dòng như approvals.repository.
//
// 🔴 Cả ba câu đều mang `wallet_id = $1`. Đây là mệnh đề chống rò rỉ chéo ví
// (bài học B3): các con số này mô tả THÓI QUEN CHI TIÊU của một gia đình —
// bỏ predicate là số của ví người khác trộn vào cảnh báo của ví mình. Negative
// control ở signals.db.test.ts chứng minh điều đó trên DB thật.
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "../../guardians/infra/guardians.schema";
import { transactionIntents } from "./intents.schema";

export type VelocityWindow = { txCount: number; total: bigint };

/** (1) VELOCITY — 1 giờ qua ví gửi mấy lệnh, tổng bao nhiêu stroops.
 * Đếm MỌI status trừ cancelled: lệnh đang treo cũng là dòng tiền đang xin ra. */
export async function velocityLastHour(walletId: string, now: Date): Promise<VelocityWindow> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [row] = await db
    .select({
      txCount: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${transactionIntents.amount}), 0)`,
    })
    .from(transactionIntents)
    .where(
      and(
        eq(transactionIntents.walletId, walletId),
        gt(transactionIntents.createdAt, since),
        ne(transactionIntents.status, "cancelled"),
      ),
    );
  return { txCount: row?.txCount ?? 0, total: BigInt(row?.total ?? "0") };
}

export type RecipientHistory = { settledCount: number; lastAt: Date | null };

/** (2) ĐỊA CHỈ QUEN HAY LẠ — ví này đã gửi THÀNH CÔNG tới địa chỉ đó mấy lần.
 * 0 = lần đầu. Chỉ đếm settled: draft/failed không phải "đã từng gửi". */
export async function recipientHistory(
  walletId: string,
  recipient: string,
): Promise<RecipientHistory> {
  const [row] = await db
    .select({
      settledCount: sql<number>`count(*)::int`,
      lastAt: sql<Date | null>`max(${transactionIntents.createdAt})`,
    })
    .from(transactionIntents)
    .where(
      and(
        eq(transactionIntents.walletId, walletId),
        eq(transactionIntents.recipient, recipient),
        eq(transactionIntents.status, "settled"),
      ),
    );
  return { settledCount: row?.settledCount ?? 0, lastAt: row?.lastAt ?? null };
}

export type SpendingBaseline = { avgAmount: string | null; maxAmount: string | null; n: number };

/** (3) MỨC THƯỜNG NGÀY — trung bình/đỉnh settled 30 ngày qua. n < 3 nghĩa là ví
 * chưa có "mức thường ngày" — caller phải trả ratio null, không bịa tỉ lệ. */
export async function spendingBaseline(walletId: string, now: Date): Promise<SpendingBaseline> {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      avgAmount: sql<string | null>`avg(${transactionIntents.amount})`,
      maxAmount: sql<string | null>`max(${transactionIntents.amount})`,
      n: sql<number>`count(*)::int`,
    })
    .from(transactionIntents)
    .where(
      and(
        eq(transactionIntents.walletId, walletId),
        eq(transactionIntents.status, "settled"),
        gt(transactionIntents.createdAt, since),
      ),
    );
  return { avgAmount: row?.avgAmount ?? null, maxAmount: row?.maxAmount ?? null, n: row?.n ?? 0 };
}

/** Authz cửa đọc tín hiệu: user này có phải guardian HIỆU LỰC của ví không.
 * `status != removed` cùng bộ lọc với guardianUserIdsForWallet — gỡ guardian
 * là mất quyền nhìn thói quen chi tiêu ngay. */
export async function isActiveGuardianUser(walletId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        eq(guardians.userId, userId),
        sql`${guardians.status} != 'removed'`,
      ),
    )
    .limit(1);
  return rows.length === 1;
}
