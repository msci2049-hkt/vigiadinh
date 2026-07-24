// Integration Postgres THẬT (PHA 4.1): guardian im 4 ngày → sweep hạ bậc offline
// + audit; sweep LẦN HAI không bắn lại (debounce = chỉ khi đổi); ack kéo về active;
// cron tick tạo ping cho ví có giờ địa phương 12:00 + notify chủ ví đúng bậc.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runPresenceTick } from "@/jobs/presence-ping";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { ackPresence, sweepLadder, walletsAtLocalHour } from "./ladder.repository";
import { presencePings } from "./presence-pings.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const OWNER = `it-owner-${crypto.randomUUID().slice(0, 8)}`;
const GUARDIAN_USER = `it-guard-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

async function makeWalletWithGuardian(input: {
  lastSeenAt: Date | null;
  status?: string;
  timezone?: string;
}): Promise<{ walletId: string; guardianId: string }> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: OWNER,
      stellarAddress: `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "B")}`,
      timezone: input.timezone ?? "UTC",
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  const [g] = await db
    .insert(guardians)
    .values({
      walletId: w.id,
      userId: GUARDIAN_USER,
      status: input.status ?? "active",
      lastSeenAt: input.lastSeenAt,
    })
    .returning({ id: guardians.id });
  if (!g) throw new Error("guardian insert failed");
  return { walletId: w.id, guardianId: g.id };
}

afterAll(async () => {
  if (!dbUp) return;
  await db.delete(notifications).where(eq(notifications.userId, OWNER));
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade guardians/pings
  }
});

describe("presence ladder (Postgres thật)", () => {
  testIt("offline 4 ngày → sweep hạ bậc + audit; sweep lần 2 im lặng (debounce)", async () => {
    const now = new Date();
    const { walletId, guardianId } = await makeWalletWithGuardian({
      lastSeenAt: new Date(now.getTime() - 4 * 86_400_000),
    });

    const first = await sweepLadder(now);
    const mine = first.filter((t) => t.guardianId === guardianId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.from).toBe("active");
    expect(mine[0]?.to).toBe("offline");

    const second = await sweepLadder(now);
    expect(second.filter((t) => t.guardianId === guardianId)).toHaveLength(0);

    const audits = await db
      .select({ kind: auditLog.kind })
      .from(auditLog)
      .where(eq(auditLog.walletId, walletId));
    expect(audits.filter((a) => a.kind === "guardian.health_changed")).toHaveLength(1);
  });

  testIt("ack kéo guardian offline về active + ghi ping acked", async () => {
    const now = new Date();
    const { guardianId } = await makeWalletWithGuardian({
      lastSeenAt: new Date(now.getTime() - 4 * 86_400_000),
      status: "offline",
    });
    const updated = await ackPresence(GUARDIAN_USER, now);
    expect(updated.some((u) => u.guardianId === guardianId)).toBe(true);

    const [g] = await db
      .select({ status: guardians.status })
      .from(guardians)
      .where(eq(guardians.id, guardianId));
    expect(g?.status).toBe("active");

    const pings = await db
      .select({ ackedAt: presencePings.ackedAt })
      .from(presencePings)
      .where(eq(presencePings.guardianId, guardianId));
    expect(pings.length).toBeGreaterThanOrEqual(1);
    expect(pings.every((p) => p.ackedAt !== null)).toBe(true);
  });

  testIt(
    "cron tick: ví tz có giờ local 12:00 nhận ping; chủ ví được notify khi đổi bậc",
    async () => {
      const now = new Date();
      // Chọn tz sao cho GIỜ HIỆN TẠI là 12h địa phương — test không phụ thuộc lúc chạy.
      const offset = (12 - now.getUTCHours() + 24) % 24;
      const tz = offset === 0 ? "UTC" : `Etc/GMT-${offset}`; // Etc/GMT-X = UTC+X (dấu NGƯỢC, chuẩn IANA)
      const { walletId, guardianId } = await makeWalletWithGuardian({
        lastSeenAt: new Date(now.getTime() - 30 * 3_600_000), // 30h → sẽ rơi bậc slow
        timezone: tz,
      });

      expect(await walletsAtLocalHour(12, now)).toContain(walletId);

      const result = await runPresenceTick(now);
      expect(result.pings).toBeGreaterThanOrEqual(1);

      const pings = await db
        .select({ id: presencePings.id })
        .from(presencePings)
        .where(eq(presencePings.guardianId, guardianId));
      expect(pings.length).toBeGreaterThanOrEqual(1);

      const notis = await db
        .select({ templateKey: notifications.templateKey })
        .from(notifications)
        .where(eq(notifications.userId, OWNER));
      expect(notis.some((n) => n.templateKey === "presence.guardian_slow")).toBe(true);
    },
  );
});
