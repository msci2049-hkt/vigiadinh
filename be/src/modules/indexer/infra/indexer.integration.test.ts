// Integration Postgres THẬT (PHA 4.2) — cổng nghiệm thu: KILL GIỮA BATCH →
// restart KHÔNG MẤT + KHÔNG TRÙNG. Kill mô phỏng bằng lỗi DB THẬT giữa batch
// (kind quá 64 ký tự → varchar chối → tx rollback) — đúng bản chất crash:
// transaction chưa commit thì mọi thứ (event + mirror + checkpoint) cùng biến mất.
import { afterAll, describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { notifications } from "../../notifications/infra/notifications.schema";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { indexerCheckpoint, indexerEvents } from "./checkpoint.schema";
import { getCheckpoint, pollOnce } from "./indexer.service";
import { checkpointOf, fakeSource, makeEvent } from "./indexer.test-support";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const OWNER = `it-idx-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];
const cleanupStreams: string[] = [];
const cleanupEventIds: string[] = [];

afterAll(async () => {
  if (!dbUp) return;
  await db.delete(notifications).where(eq(notifications.userId, OWNER));
  if (cleanupEventIds.length > 0) {
    await db.delete(indexerEvents).where(inArray(indexerEvents.id, cleanupEventIds));
  }
  if (cleanupStreams.length > 0) {
    await db.delete(indexerCheckpoint).where(inArray(indexerCheckpoint.id, cleanupStreams));
  }
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id));
  }
});

function freshStream(): string {
  const id = `it-${crypto.randomUUID().slice(0, 8)}`;
  cleanupStreams.push(id);
  return id;
}

describe("indexer core (Postgres thật)", () => {
  testIt("trang trùng event (RPC trả lặp) → mỗi event áp ĐÚNG MỘT lần", async () => {
    const stream = freshStream();
    const [a, b, c] = [makeEvent("heartbeat"), makeEvent("heartbeat"), makeEvent("heartbeat")];
    cleanupEventIds.push(a.id, b.id, c.id);

    const page1 = { events: [a, b], cursor: "cur-1", latestLedger: 100 };
    const page2 = { events: [b, c], cursor: "cur-2", latestLedger: 200 }; // b LẶP LẠI

    expect(await pollOnce(fakeSource([page1, page2]), stream)).toBe(2);
    expect(await pollOnce(fakeSource([page1, page2], 1), stream)).toBe(1); // chỉ c là mới

    const rows = await db
      .select({ id: indexerEvents.id })
      .from(indexerEvents)
      .where(inArray(indexerEvents.id, [a.id, b.id, c.id]));
    expect(rows).toHaveLength(3);
    expect(await getCheckpoint(stream)).toEqual(checkpointOf("cur-2", 200));
  });

  testIt(
    "KILL GIỮA BATCH: lỗi giữa chừng → checkpoint đứng yên, không event nào lọt; chạy lại → đủ, không trùng",
    async () => {
      const stream = freshStream();
      const good = makeEvent("heartbeat");
      const poison = makeEvent("x".repeat(70)); // kind > varchar(64) → DB chối → tx rollback
      cleanupEventIds.push(good.id, poison.id);

      const crashPage = { events: [good, poison], cursor: "cur-crash", latestLedger: 300 };
      expect(pollOnce(fakeSource([crashPage]), stream)).rejects.toThrow();

      // Sau "crash": KHÔNG MẤT — checkpoint chưa nhích, event tốt cũng chưa ghi
      // (batch atomic — restart sẽ refetch cả trang).
      expect(await getCheckpoint(stream)).toEqual(checkpointOf(null, 0));
      const afterCrash = await db
        .select({ id: indexerEvents.id })
        .from(indexerEvents)
        .where(inArray(indexerEvents.id, [good.id, poison.id]));
      expect(afterCrash).toHaveLength(0);

      // Restart với trang đã sửa (poison đổi kind hợp lệ, GIỮ NGUYÊN id — như RPC
      // trả lại đúng event đó): áp đủ 2, không trùng.
      const fixedPage = {
        events: [good, { ...poison, kind: "heartbeat" }],
        cursor: "cur-ok",
        latestLedger: 300,
      };
      expect(await pollOnce(fakeSource([fixedPage]), stream)).toBe(2);
      expect(await pollOnce(fakeSource([fixedPage]), stream)).toBe(0); // idempotent
      expect(await getCheckpoint(stream)).toEqual(checkpointOf("cur-ok", 300));
    },
  );

  testIt(
    "recovery.vetoed: mirror request → vetoed + notify chủ ví (ưu tiên cao nhất)",
    async () => {
      const stream = freshStream();
      const contractId = `C${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "C")}`;
      const [w] = await db
        .insert(wallets)
        .values({
          userId: OWNER,
          stellarAddress: `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "D")}`,
          contractId,
        })
        .returning({ id: wallets.id });
      if (!w) throw new Error("wallet insert failed");
      cleanupWalletIds.push(w.id);
      await db
        .insert(recoveryRequests)
        .values({ walletId: w.id, newOwner: "GEVIL", status: "pending" });

      const veto = { ...makeEvent("recovery.vetoed"), contractId };
      cleanupEventIds.push(veto.id);
      await pollOnce(fakeSource([{ events: [veto], cursor: "cur-v", latestLedger: 400 }]), stream);

      const [req] = await db
        .select({ status: recoveryRequests.status })
        .from(recoveryRequests)
        .where(eq(recoveryRequests.walletId, w.id));
      expect(req?.status).toBe("vetoed");

      const notis = await db
        .select({ templateKey: notifications.templateKey })
        .from(notifications)
        .where(eq(notifications.userId, OWNER));
      expect(notis.some((n) => n.templateKey === "recovery.vetoed")).toBe(true);
    },
  );

  testIt("gap (trôi quá cửa sổ RPC): ghi audit lỗ hổng, vẫn chạy tiếp", async () => {
    const stream = freshStream();
    // Checkpoint đã có (ledger 50) → nguồn báo gapFromLedger 500.
    await db.insert(indexerCheckpoint).values({ id: stream, cursor: "old", ledgerSeq: 50 });
    const e = makeEvent("heartbeat");
    cleanupEventIds.push(e.id);
    await pollOnce(
      fakeSource([{ events: [e], cursor: "cur-g", latestLedger: 600, gapFromLedger: 500 }]),
      stream,
    );
    const { auditLog } = await import("./audit-log.schema");
    const gaps = await db
      .select({ kind: auditLog.kind })
      .from(auditLog)
      .where(eq(auditLog.kind, "indexer.gap"));
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(await getCheckpoint(stream)).toEqual(checkpointOf("cur-g", 600));
  });
});
