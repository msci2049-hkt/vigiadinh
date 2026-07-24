// Repository heartbeat (PHA 4.3): sweep leo thang + chạm "tôi vẫn ổn" của owner.
// Notify chỉ khi tier TĂNG (debounce); mỗi lần đổi tier ghi audit cùng transaction.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { enqueueNotificationTx } from "@/modules/notifications";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { heartbeatTier, tierTemplate } from "../domain/heartbeat-ladder";
import { heartbeats } from "./heartbeats.schema";
import { inheritancePlans } from "./inheritance-plans.schema";

export type HeartbeatEscalation = {
  walletId: string;
  ownerUserId: string;
  fromTier: number;
  toTier: number;
};

/** Quét mọi plan ACTIVE — leo thang nếu im lặng thêm kỳ, notify đúng đối tượng. */
export async function sweepHeartbeats(now: Date): Promise<HeartbeatEscalation[]> {
  const plans = await db
    .select({
      planId: inheritancePlans.id,
      walletId: inheritancePlans.walletId,
      inactivitySecs: inheritancePlans.inactivityPeriodSecs,
      tier: inheritancePlans.escalationTier,
      anchorAt: inheritancePlans.createdAt,
      ownerUserId: wallets.userId,
    })
    .from(inheritancePlans)
    .innerJoin(wallets, eq(inheritancePlans.walletId, wallets.id))
    .where(eq(inheritancePlans.status, "active"));

  const escalations: HeartbeatEscalation[] = [];
  for (const plan of plans) {
    const [lastBeat] = await db
      .select({ at: heartbeats.at })
      .from(heartbeats)
      .where(eq(heartbeats.walletId, plan.walletId))
      .orderBy(desc(heartbeats.at))
      .limit(1);
    // Chưa từng beat → kỳ tính từ lúc tạo plan (createdAt) — không leo vô hạn từ null.
    const computed = heartbeatTier(lastBeat?.at ?? plan.anchorAt, plan.inactivitySecs, now);
    if (computed <= plan.tier) continue; // không tăng — im (debounce); KHÔNG tự hạ tier ở sweep

    await db.transaction(async (tx) => {
      await tx
        .update(inheritancePlans)
        .set({ escalationTier: computed })
        .where(
          and(eq(inheritancePlans.id, plan.planId), eq(inheritancePlans.escalationTier, plan.tier)),
        );
      await tx.insert(auditLog).values({
        walletId: plan.walletId,
        kind: "heartbeat.escalated",
        actorType: "system",
        payload: { fromTier: plan.tier, toTier: computed },
      });
      const route = tierTemplate(computed);
      if (!route) return;
      if (route.audience === "owner") {
        await enqueueNotificationTx(tx, {
          userId: plan.ownerUserId,
          templateKey: route.template,
          params: {
            walletId: plan.walletId,
            days: Math.floor((plan.inactivitySecs * computed) / 86_400),
          },
          channel: "push",
        });
      } else {
        const guards = await tx
          .select({ userId: guardians.userId })
          .from(guardians)
          .where(and(eq(guardians.walletId, plan.walletId), eq(guardians.status, "active")));
        for (const g of guards) {
          if (!g.userId) continue;
          await enqueueNotificationTx(tx, {
            userId: g.userId,
            templateKey: route.template,
            params: { walletId: plan.walletId },
            channel: "push",
          });
        }
      }
    });
    escalations.push({
      walletId: plan.walletId,
      ownerUserId: plan.ownerUserId,
      fromTier: plan.tier,
      toTier: computed,
    });
  }
  return escalations;
}

/** Owner chạm "tôi vẫn ổn": ghi beat + reset tier + audit. Trả false nếu ví
 * không thuộc user (ownership lớp 2 — route đã requireAuth). */
export async function recordHeartbeat(
  walletId: string,
  userId: string,
  now: Date,
): Promise<boolean> {
  const [w] = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
  if (!w) return false;
  await db.transaction(async (tx) => {
    await tx.insert(heartbeats).values({ walletId, at: now });
    await tx
      .update(inheritancePlans)
      .set({ escalationTier: 0 })
      .where(eq(inheritancePlans.walletId, walletId));
    await tx.insert(auditLog).values({
      walletId,
      kind: "heartbeat.received",
      actorType: "owner",
      actorId: userId,
      payload: {},
    });
  });
  return true;
}
