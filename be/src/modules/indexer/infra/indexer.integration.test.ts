// Integration Postgres THẬT (PHA 4.2) — cổng nghiệm thu: KILL GIỮA BATCH →
// restart KHÔNG MẤT + KHÔNG TRÙNG. Kill mô phỏng bằng lỗi DB THẬT giữa batch
// (kind quá 64 ký tự → varchar chối → tx rollback) — đúng bản chất crash:
// transaction chưa commit thì mọi thứ (event + mirror + checkpoint) cùng biến mất.
import { afterAll, describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { Contract, nativeToScVal, type rpc, StrKey, xdr } from "@stellar/stellar-sdk";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { notifications } from "../../notifications/infra/notifications.schema";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { auditLog } from "./audit-log.schema";
import { indexerCheckpoint, indexerEvents } from "./checkpoint.schema";
import { getCheckpoint, pollOnce } from "./indexer.service";
import { checkpointOf, fakeSource, makeEvent } from "./indexer.test-support";
import { simplifyEvent } from "./rpc-source";

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

  testIt(
    "registry on-chain (PHA 5.2): initiate → approve → cancel mirror theo topics[1], trọn vòng đời",
    async () => {
      const stream = freshStream();
      const registryId = `C${"R".repeat(55)}`;
      const walletAddress = `G${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "E")}`;
      const [w] = await db
        .insert(wallets)
        .values({ userId: OWNER, stellarAddress: walletAddress, threshold: 2 })
        .returning({ id: wallets.id });
      if (!w) throw new Error("wallet insert failed");
      cleanupWalletIds.push(w.id);

      const guardian = `G${"G".repeat(55)}`;
      // Registry v2: value initiate = (initiator, fingerprint sha256 Signer mới).
      const fingerprint = new Uint8Array(32).fill(0xab);
      const fingerprintHex56 = Buffer.from(fingerprint).toString("hex").slice(0, 56);
      // Shape data đúng rpc-source.simplify: {topics, value, txHash}; MỌI event chung
      // contractId = registry — ví chỉ nhận ra được qua topics[1].
      const initiate = {
        ...makeEvent("initiate"),
        ledger: 1,
        contractId: registryId,
        data: {
          topics: ["initiate", walletAddress],
          value: [guardian, fingerprint],
          txHash: "a".repeat(64),
        },
      };
      const approve = {
        ...makeEvent("approve"),
        ledger: 2,
        contractId: registryId,
        data: { topics: ["approve", walletAddress], value: [guardian, 1], txHash: "b".repeat(64) },
      };
      const cancel = {
        ...makeEvent("cancel"),
        ledger: 3,
        contractId: registryId,
        data: { topics: ["cancel", walletAddress], value: walletAddress, txHash: "c".repeat(64) },
      };
      cleanupEventIds.push(initiate.id, approve.id, cancel.id);

      await pollOnce(
        fakeSource([{ events: [initiate, approve], cursor: "cur-r1", latestLedger: 10 }]),
        stream,
      );
      const [afterApprove] = await db
        .select()
        .from(recoveryRequests)
        .where(eq(recoveryRequests.walletId, w.id));
      expect(afterApprove?.status).toBe("pending");
      expect(afterApprove?.newOwner).toBe(fingerprintHex56);
      expect(afterApprove?.approvals).toBe(1);
      expect(afterApprove?.threshold).toBe(2);
      expect(afterApprove?.txHash).toBe("a".repeat(64));

      await pollOnce(
        fakeSource([{ events: [cancel], cursor: "cur-r2", latestLedger: 20 }], 0),
        stream,
      );
      const [afterCancel] = await db
        .select({ status: recoveryRequests.status })
        .from(recoveryRequests)
        .where(eq(recoveryRequests.walletId, w.id));
      expect(afterCancel?.status).toBe("vetoed");

      // Notify chủ ví: initiate + approve + cancel đều có template.
      const notis = await db
        .select({ templateKey: notifications.templateKey })
        .from(notifications)
        .where(eq(notifications.userId, OWNER));
      for (const key of ["recovery.initiated", "recovery.approved", "recovery.vetoed"]) {
        expect(notis.some((n) => n.templateKey === key)).toBe(true);
      }
    },
  );

  // ── Sự cố 2026-07-30: BigInt của ScVal u64 làm chết indexer 48 phút ─────────
  // Ca chứng minh TRỰC TIẾP: dựng ScVal THẬT của event `register` (threshold u32
  // = 2, timelock u64 = 86400) → chạy qua ĐÚNG `simplifyEvent` của rpc-source →
  // pollOnce ghi vào jsonb. Trước khi vá, chính event này throw "cannot serialize
  // BigInt", rollback cả transaction, checkpoint đứng, poll sau fetch lại nó.
  testIt("event `register` có timelock u64 86400 → ghi được vào jsonb, KHÔNG throw", async () => {
    const stream = freshStream();
    // Ở ca này địa chỉ phải là StrKey THẬT (có checksum): `Contract` và ScVal
    // address decode chứ không nhận chuỗi bịa như các ca chỉ ghi DB phía trên.
    const registryId = StrKey.encodeContract(randomBytes(32));
    const walletAddress = StrKey.encodeEd25519PublicKey(randomBytes(32));
    const [w] = await db
      .insert(wallets)
      .values({ userId: OWNER, stellarAddress: walletAddress, threshold: 2 })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);

    // ScVal THẬT — không phải data đã decode bằng tay: u64 phải đi qua
    // scValToNative để thành BigInt, đó mới là ca thật.
    const raw = {
      id: `ev-bigint-${crypto.randomUUID()}`,
      ledger: 3_875_394,
      contractId: new Contract(registryId),
      topic: [
        nativeToScVal("register", { type: "symbol" }),
        nativeToScVal(walletAddress, { type: "address" }),
      ],
      value: xdr.ScVal.scvVec([
        nativeToScVal(2, { type: "u32" }),
        nativeToScVal(86_400n, { type: "u64" }),
      ]),
      txHash: "d".repeat(64),
    } as unknown as rpc.Api.EventResponse;

    const event = simplifyEvent(raw);
    cleanupEventIds.push(event.id);
    expect(event.kind).toBe("register");
    // Đây là chỗ vá: u64 ra string, KHÔNG còn BigInt nào trong data.
    expect((event.data as { value: unknown }).value).toEqual([2, "86400"]);
    expect(JSON.stringify(event.data)).toContain('"86400"');

    expect(
      await pollOnce(
        fakeSource([{ events: [event], cursor: "cur-u64", latestLedger: 3_875_400 }]),
        stream,
      ),
    ).toBe(1);

    // Ghi THẬT vào cả hai cột jsonb (indexer_events + audit_log), đọc lại được.
    const [row] = await db
      .select({ payload: indexerEvents.payload })
      .from(indexerEvents)
      .where(eq(indexerEvents.id, event.id));
    expect((row?.payload as { value?: unknown } | null)?.value).toEqual([2, "86400"]);
    const audits = await db
      .select({ kind: auditLog.kind, payload: auditLog.payload })
      .from(auditLog)
      .where(eq(auditLog.walletId, w.id));
    expect(audits.some((a) => a.kind === "register")).toBe(true);

    // Checkpoint NHÍCH — cái đứng yên 48 phút trong sự cố.
    expect(await getCheckpoint(stream)).toEqual(checkpointOf("cur-u64", 3_875_400));
  });

  testIt("BigInt chưa ép (bỏ qua rìa RPC) VẪN chết — vá đúng chỗ mới có tác dụng", async () => {
    const stream = freshStream();
    const poison = makeEvent("heartbeat");
    // Mô phỏng data như `scValToNative` trả về khi KHÔNG có toJsonSafe.
    const raw = { ...poison, data: { topics: ["heartbeat"], value: [2, 86_400n] } };
    cleanupEventIds.push(poison.id);
    expect(
      pollOnce(fakeSource([{ events: [raw], cursor: "cur-bad", latestLedger: 500 }]), stream),
    ).rejects.toThrow();
    // Và đúng như sự cố thật: checkpoint KHÔNG nhích → poll sau fetch lại nó.
    expect(await getCheckpoint(stream)).toEqual(checkpointOf(null, 0));
  });

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
    const gaps = await db
      .select({ kind: auditLog.kind })
      .from(auditLog)
      .where(eq(auditLog.kind, "indexer.gap"));
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(await getCheckpoint(stream)).toEqual(checkpointOf("cur-g", 600));
  });
});
