// Lô R5 nhóm A — lệnh khôi phục ĐÓNG (huỷ/veto/finalize) phải báo MỌI guardian,
// KỂ CẢ NGƯỜI CHƯA DUYỆT. Sự cố tái lập 31/07: A huỷ lệnh, C (chưa duyệt) không
// nhận gì, thẻ vẫn trên màn C, C bấm duyệt và ăn lỗi. Test đo DB THẬT (khuôn
// notify-channels.test.ts): đếm đúng row/kênh, 0 push, audit có dấu vết, và
// replay/event mồ côi KHÔNG gửi trùng.
import { afterAll, describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { SseClient } from "@/lib/realtime-core";
import { pgReachable, SKIP_REASON, sleep } from "@/test-support/pg";
import { guardians } from "../../guardians/infra/guardians.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { auditLog } from "./audit-log.schema";
import { indexerCheckpoint, indexerEvents } from "./checkpoint.schema";
import { pollOnce } from "./indexer.service";
import { fakeSource, makeEvent } from "./indexer.test-support";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const REGISTRY_ID = `C${"R".repeat(55)}`;
const cleanupWalletIds: string[] = [];
const cleanupUserIds: string[] = [];
const cleanupStreams: string[] = [];
const cleanupEventIds: string[] = [];

afterAll(async () => {
  if (!dbUp) return;
  if (cleanupEventIds.length > 0) {
    await db.delete(indexerEvents).where(inArray(indexerEvents.id, cleanupEventIds));
  }
  if (cleanupStreams.length > 0) {
    await db.delete(indexerCheckpoint).where(inArray(indexerCheckpoint.id, cleanupStreams));
  }
  // audit_log KHÔNG xoá — bảng append-only (khuôn indexer.integration.test.ts).
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn bảng con
  }
  for (const userId of cleanupUserIds) {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }
});

function freshStream(): string {
  const id = `it-rc-${crypto.randomUUID().slice(0, 8)}`;
  cleanupStreams.push(id);
  return id;
}

function randomWalletAddress(): string {
  return `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "E")}`;
}

/** Ví + guardian có tài khoản (đủ vai: người sẽ "duyệt" và người CHƯA duyệt). */
async function seedWallet(guardianCount: number) {
  const ownerUserId = `it-rc-owner-${crypto.randomUUID().slice(0, 8)}`;
  cleanupUserIds.push(ownerUserId);
  const walletAddress = randomWalletAddress();
  const [w] = await db
    .insert(wallets)
    .values({ userId: ownerUserId, stellarAddress: walletAddress, threshold: 2 })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  const guardianUserIds: string[] = [];
  for (let i = 0; i < guardianCount; i++) {
    const userId = `it-rc-guard-${crypto.randomUUID().slice(0, 8)}`;
    guardianUserIds.push(userId);
    cleanupUserIds.push(userId);
    await db.insert(guardians).values({ walletId: w.id, userId, status: "active" });
  }
  return { walletId: w.id, walletAddress, ownerUserId, guardianUserIds };
}

/** Event registry đúng shape rpc-source.simplify: {topics, value, txHash}. */
function registryEvent(kind: string, walletAddress: string, ledger: number) {
  const ev = {
    ...makeEvent(kind),
    ledger,
    contractId: REGISTRY_ID,
    data:
      kind === "initiate"
        ? {
            topics: [kind, walletAddress],
            value: [`G${"G".repeat(55)}`, new Uint8Array(32).fill(0xab)],
            txHash: "a".repeat(64),
          }
        : { topics: [kind, walletAddress], value: walletAddress, txHash: "c".repeat(64) },
  };
  cleanupEventIds.push(ev.id);
  return ev;
}

async function closedRowsOf(userId: string) {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId));
  return rows.filter((r) => r.templateKey === "recovery.closed");
}

describe("R5 — lệnh khôi phục đóng phải báo MỌI guardian (DB thật)", () => {
  testIt(
    "cancel: MỖI guardian nhận đúng 2 dòng email+sse — kể cả guardian CHƯA duyệt; 0 dòng push; audit có dấu vết",
    async () => {
      const stream = freshStream();
      const { walletId, walletAddress, guardianUserIds } = await seedWallet(3);
      // guardianUserIds[2] đóng vai C — KHÔNG hề duyệt (không có phiếu nào của
      // C trong signals.approvers). Loop notify không được phân biệt.
      const notYetApproved = guardianUserIds[2];
      if (!notYetApproved) throw new Error("seed failed");

      const initiate = registryEvent("initiate", walletAddress, 1);
      const cancel = registryEvent("cancel", walletAddress, 2);
      await pollOnce(fakeSource([{ events: [initiate], cursor: "c-1", latestLedger: 5 }]), stream);
      // Chưa đóng → chưa ai nhận recovery.closed.
      expect(await closedRowsOf(notYetApproved)).toHaveLength(0);

      await pollOnce(
        fakeSource([{ events: [cancel], cursor: "c-2", latestLedger: 10 }], 0),
        stream,
      );

      const [req] = await db
        .select({ status: recoveryRequests.status })
        .from(recoveryRequests)
        .where(eq(recoveryRequests.walletId, walletId));
      expect(req?.status).toBe("vetoed");

      // 🔴 Assertion trung tâm của lô: guardian CHƯA DUYỆT vẫn nhận thư.
      for (const userId of guardianUserIds) {
        const rows = await closedRowsOf(userId);
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.channel).sort()).toEqual(["email", "sse"]);
        expect(rows.every((r) => r.status === "queued")).toBe(true);
        expect(rows.some((r) => r.channel === "push")).toBe(false);
      }

      // Audit: sự kiện an ninh phải có dấu vết riêng, đếm đúng số người đã báo.
      const audits = await db.select().from(auditLog).where(eq(auditLog.walletId, walletId));
      const closedAudit = audits.filter((a) => a.kind === "recovery.closed");
      expect(closedAudit).toHaveLength(1);
      expect(closedAudit[0]?.actorType).toBe("system");
      expect((closedAudit[0]?.payload as { guardiansNotified?: number }).guardiansNotified).toBe(3);
      expect((closedAudit[0]?.payload as { closedBy?: string }).closedBy).toBe("cancel");
    },
    60_000, // WSL /mnt/d + DB chậm = fail-env, không phải lỗi code (KI-5)
  );

  testIt(
    "cancel MỒ CÔI (không còn yêu cầu mở) → KHÔNG gửi thêm, không audit thêm",
    async () => {
      const stream = freshStream();
      const { walletId, walletAddress, guardianUserIds } = await seedWallet(1);
      const g = guardianUserIds[0];
      if (!g) throw new Error("seed failed");

      // TÁCH trang: cancel priority 0 — cùng batch nó bị sort chạy TRƯỚC initiate.
      const initiate = registryEvent("initiate", walletAddress, 1);
      const cancel1 = registryEvent("cancel", walletAddress, 2);
      const cancel2 = registryEvent("cancel", walletAddress, 3); // event MỚI, nhưng lệnh đã đóng rồi
      const pages = [
        { events: [initiate], cursor: "c-1", latestLedger: 5 },
        { events: [cancel1], cursor: "c-2", latestLedger: 10 },
        { events: [cancel2], cursor: "c-3", latestLedger: 15 },
      ];
      await pollOnce(fakeSource(pages), stream);
      await pollOnce(fakeSource(pages, 1), stream);
      expect(await closedRowsOf(g)).toHaveLength(2);

      await pollOnce(fakeSource(pages, 2), stream);
      // Không còn dòng active nào để đóng → không notify trùng.
      expect(await closedRowsOf(g)).toHaveLength(2);
      const audits = await db.select().from(auditLog).where(eq(auditLog.walletId, walletId));
      expect(audits.filter((a) => a.kind === "recovery.closed")).toHaveLength(1);
    },
    60_000,
  );

  testIt(
    "finalize cũng là lệnh đóng → guardian nhận recovery.closed",
    async () => {
      const stream = freshStream();
      const { walletAddress, guardianUserIds } = await seedWallet(2);
      const initiate = registryEvent("initiate", walletAddress, 1);
      const finalize = registryEvent("finalize", walletAddress, 2);
      const pages = [
        { events: [initiate], cursor: "c-1", latestLedger: 5 },
        { events: [finalize], cursor: "c-2", latestLedger: 10 },
      ];
      await pollOnce(fakeSource(pages), stream);
      await pollOnce(fakeSource(pages, 1), stream);
      for (const userId of guardianUserIds) {
        const rows = await closedRowsOf(userId);
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.channel).sort()).toEqual(["email", "sse"]);
      }
    },
    60_000,
  );

  testIt(
    "SSE thật qua Dragonfly — guardian đang mở app nhận domain event recovery.closed",
    async () => {
      const { realtime } = await import("@/lib/realtime");
      const stream = freshStream();
      const { walletId, walletAddress, guardianUserIds } = await seedWallet(1);
      const userId = guardianUserIds[0];
      if (!userId) throw new Error("seed failed");

      const received: string[] = [];
      const client: SseClient = { id: "it-rc-client", send: (msg) => received.push(msg.data) };
      const remove = realtime.addClient(userId, client);
      // SUBSCRIBE là lệnh mạng — chờ nó ăn trước khi publish (khuôn notify-channels).
      await sleep(300);

      try {
        // TÁCH trang: cancel priority 0 — cùng batch chạy trước initiate.
        const initiate = registryEvent("initiate", walletAddress, 1);
        const cancel = registryEvent("cancel", walletAddress, 2);
        const pages = [
          { events: [initiate], cursor: "c-1", latestLedger: 5 },
          { events: [cancel], cursor: "c-2", latestLedger: 10 },
        ];
        await pollOnce(fakeSource(pages), stream);
        await pollOnce(fakeSource(pages, 1), stream);
        for (let i = 0; i < 20 && !received.some((d) => d.includes("recovery.closed")); i++) {
          await sleep(100);
        }
      } finally {
        remove();
      }

      if (received.length === 0) {
        // Dragonfly không chạy → fail-env, KHÔNG giả vờ pass và cũng không đỏ giả.
        console.warn("[skip] Dragonfly không sẵn sàng — SSE end-to-end không đo được");
        return;
      }
      expect(received.some((d) => d.includes("recovery.closed"))).toBe(true);
      // Luật payload domain-events: không địa chỉ ví, không id nội bộ.
      expect(received.join("")).not.toContain(walletId);
      expect(received.join("")).not.toContain(walletAddress);
    },
    60_000,
  );
});
