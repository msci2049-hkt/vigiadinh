// Repository ladder (PHA 4.1) — sweep trạng thái + ack/confirm. Debounce
// guardian.health_changed = CHỈ khi GIÁ TRỊ status đổi (sweep so trước/sau);
// mỗi transition ghi audit (append-only) trong CÙNG transaction.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { ladderStatus } from "../domain/ladder";
import { presencePings } from "./presence-pings.schema";

const LADDER_STATES = ["active", "slow", "offline"] as const;

export type LadderTransition = {
  guardianId: string;
  walletId: string;
  ownerUserId: string;
  from: string;
  to: "active" | "slow" | "offline";
};

/** Quét ladder toàn hệ — trả transitions ĐÃ áp dụng (caller notify chủ ví). */
export async function sweepLadder(now: Date): Promise<LadderTransition[]> {
  const rows = await db
    .select({
      id: guardians.id,
      walletId: guardians.walletId,
      status: guardians.status,
      lastSeenAt: guardians.lastSeenAt,
      ownerUserId: wallets.userId,
    })
    .from(guardians)
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    .where(inArray(guardians.status, [...LADDER_STATES]));

  const transitions: LadderTransition[] = [];
  for (const row of rows) {
    const next = ladderStatus(row.lastSeenAt, now);
    if (next !== row.status) {
      transitions.push({
        guardianId: row.id,
        walletId: row.walletId,
        ownerUserId: row.ownerUserId,
        from: row.status,
        to: next,
      });
    }
  }
  if (transitions.length === 0) return transitions;

  await db.transaction(async (tx) => {
    for (const t of transitions) {
      await tx.update(guardians).set({ status: t.to }).where(eq(guardians.id, t.guardianId));
    }
    await tx.insert(auditLog).values(
      transitions.map((t) => ({
        walletId: t.walletId,
        kind: "guardian.health_changed",
        actorType: "system",
        payload: { guardianId: t.guardianId, from: t.from, to: t.to },
      })),
    );
  });
  return transitions;
}

/** Ack từ máy guardian: MỌI dòng guardian của user này (một chạm = người còn đó).
 * Trả các guardian đã cập nhật để caller quyết notify (đổi bậc về active). */
export async function ackPresence(
  userId: string,
  now: Date,
): Promise<{ guardianId: string; walletId: string; previousStatus: string }[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: guardians.id, walletId: guardians.walletId, status: guardians.status })
      .from(guardians)
      .where(and(eq(guardians.userId, userId), inArray(guardians.status, [...LADDER_STATES])));
    for (const row of rows) {
      await tx
        .update(guardians)
        .set({ lastSeenAt: now, status: "active" })
        .where(eq(guardians.id, row.id));
      await tx.insert(presencePings).values({ guardianId: row.id, sentAt: now, ackedAt: now });
    }
    return rows.map((r) => ({ guardianId: r.id, walletId: r.walletId, previousStatus: r.status }));
  });
}

/** Xác nhận TAY 90 ngày ("tôi còn đây") — chạm thật của con người. */
export async function manualConfirm(userId: string, now: Date): Promise<number> {
  const rows = await db
    .update(guardians)
    .set({ lastManualConfirmAt: now, lastSeenAt: now, status: "active" })
    .where(and(eq(guardians.userId, userId), inArray(guardians.status, [...LADDER_STATES])))
    .returning({ id: guardians.id });
  return rows.length;
}

/** Ví có giờ địa phương đúng `hour` — cron ping 12:00 theo tz CHỦ VÍ. */
export async function walletsAtLocalHour(hour: number, now: Date): Promise<string[]> {
  const rows = await db.select({ id: wallets.id, timezone: wallets.timezone }).from(wallets);
  return rows
    .filter((w) => {
      try {
        const local = new Intl.DateTimeFormat("en-US", {
          timeZone: w.timezone,
          hour: "numeric",
          hour12: false,
        }).format(now);
        return Number.parseInt(local, 10) % 24 === hour;
      } catch {
        return false; // tz rác trong DB — bỏ qua, không chết cron
      }
    })
    .map((w) => w.id);
}

/** Gửi ping 12:00 cho guardian đang theo dõi của các ví — trả số ping đã tạo. */
export async function sendDailyPings(walletIds: string[], now: Date): Promise<number> {
  if (walletIds.length === 0) return 0;
  const rows = await db
    .select({ id: guardians.id, userId: guardians.userId })
    .from(guardians)
    .where(
      and(inArray(guardians.walletId, walletIds), inArray(guardians.status, [...LADDER_STATES])),
    );
  if (rows.length === 0) return 0;
  await db.insert(presencePings).values(rows.map((g) => ({ guardianId: g.id, sentAt: now })));
  return rows.length;
}
