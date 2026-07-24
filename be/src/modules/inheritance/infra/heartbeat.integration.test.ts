// Integration heartbeat (Postgres thật, PHA 4.3): im 95 ngày → leo thẳng tier 3
// (gợi ý claim tới NGƯỜI THÂN, không phải owner); sweep lần 2 im (debounce);
// owner chạm "tôi vẫn ổn" → tier về 0 + audit; server KHÔNG có hành động on-chain.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../guardians/infra/guardians.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { recordHeartbeat, sweepHeartbeats } from "./heartbeat.repository";
import { heartbeats } from "./heartbeats.schema";
import { inheritancePlans } from "./inheritance-plans.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const OWNER = `it-hb-owner-${crypto.randomUUID().slice(0, 8)}`;
const GUARD = `it-hb-guard-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

afterAll(async () => {
  if (!dbUp) return;
  await db.delete(notifications).where(eq(notifications.userId, OWNER));
  await db.delete(notifications).where(eq(notifications.userId, GUARD));
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id));
  }
});

async function seed(silenceDays: number): Promise<{ walletId: string }> {
  const now = Date.now();
  const [w] = await db
    .insert(wallets)
    .values({
      userId: OWNER,
      stellarAddress: `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "E")}`,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values({ walletId: w.id, userId: GUARD, status: "active" });
  await db
    .insert(inheritancePlans)
    .values({ walletId: w.id, status: "active", inactivityPeriodSecs: 30 * 86_400 });
  await db
    .insert(heartbeats)
    .values({ walletId: w.id, at: new Date(now - silenceDays * 86_400_000) });
  return { walletId: w.id };
}

describe("heartbeat thừa kế (Postgres thật)", () => {
  testIt("im 95 ngày → tier 3: GỢI Ý claim tới người thân; sweep lần 2 im lặng", async () => {
    const { walletId } = await seed(95);
    const first = await sweepHeartbeats(new Date());
    const mine = first.filter((e) => e.walletId === walletId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.toTier).toBe(3);

    // Debounce: quét lại không leo thêm, không notify lặp.
    const second = await sweepHeartbeats(new Date());
    expect(second.filter((e) => e.walletId === walletId)).toHaveLength(0);

    // Gợi ý claim tới NGƯỜI THÂN (guardian user), KHÔNG tới owner.
    const guardNotis = await db
      .select({ templateKey: notifications.templateKey })
      .from(notifications)
      .where(eq(notifications.userId, GUARD));
    expect(guardNotis.some((n) => n.templateKey === "inheritance.suggest_claim")).toBe(true);
  });

  testIt("im 31 ngày → tier 1: nhắc OWNER, người thân chưa bị làm phiền", async () => {
    const { walletId } = await seed(31);
    const esc = (await sweepHeartbeats(new Date())).filter((e) => e.walletId === walletId);
    expect(esc[0]?.toTier).toBe(1);
    const ownerNotis = await db
      .select({ templateKey: notifications.templateKey })
      .from(notifications)
      .where(eq(notifications.userId, OWNER));
    expect(ownerNotis.some((n) => n.templateKey === "heartbeat.reminder")).toBe(true);
  });

  testIt("owner chạm 'tôi vẫn ổn' → tier về 0; user lạ bị chối NOT_OWNER", async () => {
    const { walletId } = await seed(95);
    await sweepHeartbeats(new Date());

    expect(await recordHeartbeat(walletId, "ke-la", new Date())).toBe(false);
    expect(await recordHeartbeat(walletId, OWNER, new Date())).toBe(true);

    const [plan] = await db
      .select({ tier: inheritancePlans.escalationTier })
      .from(inheritancePlans)
      .where(eq(inheritancePlans.walletId, walletId));
    expect(plan?.tier).toBe(0);
  });
});
