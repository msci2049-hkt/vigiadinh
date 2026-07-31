// Lô R6 — cổng nghiệm thu của mốc ĐỦ PHIẾU, đo trên Postgres THẬT.
//
// Trước lô này không một dòng nào trong be/ so `approvals` với `threshold`:
// `'ready'` chỉ sống trong CHECK constraint và mệnh đề ĐỌC. Hệ quả dây chuyền:
// chủ ví không nhận cảnh báo ở mốc nguy hiểm nhất, và người xin khôi phục kẹt
// vĩnh viễn ở nút disabled (`recovery/progress.tsx` gate `status === "ready"`).
//
// Bốn chuyện phải khoá ở đây, cái nào cũng từng là lỗ thật:
//   1. đủ phiếu → `ready`; thiếu phiếu → vẫn `pending`
//   2. ngưỡng 1 → `initiate` ra `ready` NGAY (contract lib.rs:323-327)
//   3. lá thư `recovery.threshold_met` phát ĐÚNG MỘT LẦN, kể cả khi có phiếu
//      thứ ba bay vào sau đó — gác nằm ở WHERE của UPDATE, không ở dedupe event
//   4. `recovery.vetoed` KHÔNG được đụng dòng đã `executed` (A3)
import { afterAll, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../guardians/infra/guardians.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { getCheckpoint, pollOnce } from "./indexer.service";
import { fakeSource, makeEvent } from "./indexer.test-support";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const REGISTRY = `C${"R".repeat(55)}`;
const cleanupWalletIds: string[] = [];
const cleanupUserIds: string[] = [];
const cleanupStreams: string[] = [];

function randomAddress(prefix: "C" | "G" = "C"): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "A")}`;
}

function freshStream(): string {
  const id = `it-r6-${crypto.randomUUID().slice(0, 8)}`;
  cleanupStreams.push(id);
  return id;
}

/** Ví + chủ ví riêng cho từng ca (đếm notification theo owner nên không dùng chung). */
async function seedWallet(threshold: number, timelockSecs = 86_400) {
  const ownerUserId = `it-r6-owner-${crypto.randomUUID().slice(0, 8)}`;
  cleanupUserIds.push(ownerUserId);
  const [w] = await db
    .insert(wallets)
    .values({ userId: ownerUserId, stellarAddress: randomAddress("G"), threshold, timelockSecs })
    .returning({ id: wallets.id, stellarAddress: wallets.stellarAddress });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  return { ...w, ownerUserId };
}

/** Event registry: mọi ví chung contractId = registry, ví nằm ở topics[1]. */
function registryEvent(kind: string, walletAddress: string, value: unknown, ledger: number) {
  const e = {
    ...makeEvent(kind),
    ledger,
    contractId: REGISTRY,
    data: { topics: [kind, walletAddress], value, txHash: `${ledger}`.padStart(64, "e") },
  };
  return e;
}

async function apply(events: ReturnType<typeof registryEvent>[], stream: string, at = 0) {
  return pollOnce(
    fakeSource(
      [{ events, cursor: `cur-${crypto.randomUUID().slice(0, 6)}`, latestLedger: 99 }],
      at,
    ),
    stream,
  );
}

async function requestOf(walletId: string) {
  const [row] = await db
    .select()
    .from(recoveryRequests)
    .where(eq(recoveryRequests.walletId, walletId));
  return row;
}

async function notifyRows(userId: string, templateKey: string) {
  return db
    .select({ channel: notifications.channel })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.templateKey, templateKey)));
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn bảng con
  }
  for (const userId of cleanupUserIds) {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }
});

describe("R6 nhóm A — approvals >= threshold thì status phải sang 'ready'", () => {
  testIt("đủ phiếu (2/2) → ready", async () => {
    const stream = freshStream();
    const w = await seedWallet(2);
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(1)],
          1,
        ),
      ],
      stream,
    );
    expect((await requestOf(w.id))?.status).toBe("pending");

    await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);
    expect((await requestOf(w.id))?.status).toBe("ready");
    expect(await getCheckpoint(stream)).toBeTruthy();
  });

  // R7 (C1) — trước lô này cột `expires_at` chưa từng được ai ghi, nên không có
  // cách nào biết một dòng mirror đã chết vì hết giờ.
  testIt("R7 — initiate điền expires_at = timelock + 7 ngày ân hạn", async () => {
    const stream = freshStream();
    const timelockSecs = 86_400;
    const w = await seedWallet(2, timelockSecs);
    const before = Date.now();
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(7)],
          1,
        ),
      ],
      stream,
    );
    const row = await requestOf(w.id);
    expect(row?.expiresAt).toBeTruthy();
    // ƯỚC LƯỢNG neo vào đồng hồ BE (event `initiate` không chở `started_at` lẫn
    // `expires_at` — lib.rs:329-333), nên chỉ khẳng định được cửa sổ, không phải
    // mốc chính xác. Nợ này đã ghi trong known issues.
    const expected = before + (timelockSecs + 7 * 86_400) * 1000;
    const actual = row?.expiresAt?.getTime() ?? 0;
    expect(actual).toBeGreaterThanOrEqual(expected - 1000);
    expect(actual).toBeLessThanOrEqual(expected + 60_000);
    // Phải muộn hơn mốc chặn: hết cửa sổ veto rồi vẫn còn 7 ngày để hoàn tất.
    expect(actual).toBeGreaterThan(row?.vetoUntil?.getTime() ?? 0);
  });

  testIt("THIẾU phiếu (2/3) → vẫn pending", async () => {
    const stream = freshStream();
    const w = await seedWallet(3);
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(2)],
          1,
        ),
      ],
      stream,
    );
    await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);
    const row = await requestOf(w.id);
    expect(row?.status).toBe("pending");
    expect(row?.approvals).toBe(2);
    expect(row?.threshold).toBe(3);
  });

  testIt("ngưỡng 1 → initiate ra 'ready' NGAY (contract lib.rs:323-327)", async () => {
    const stream = freshStream();
    const w = await seedWallet(1);
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(3)],
          1,
        ),
      ],
      stream,
    );
    const row = await requestOf(w.id);
    expect(row?.status).toBe("ready");
    expect(row?.approvals).toBe(1);
    // Và chủ ví được báo ngay ở mốc đó — ví ngưỡng 1 không có phiếu nào tới sau.
    expect((await notifyRows(w.ownerUserId, "recovery.threshold_met")).length).toBe(2);
  });

  testIt("ngưỡng ví ĐỔI sau khi mở → luật của yêu cầu đang chạy vẫn là ngưỡng LÚC MỞ", async () => {
    const stream = freshStream();
    const w = await seedWallet(3);
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(4)],
          1,
        ),
      ],
      stream,
    );
    // Chủ ví hạ ngưỡng ví xuống 2 SAU khi yêu cầu đã mở với ngưỡng 3.
    await db.update(wallets).set({ threshold: 2 }).where(eq(wallets.id, w.id));
    await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);
    // Dòng giữ threshold 3 → 2 phiếu CHƯA đủ. Nếu so nhầm với wallets.threshold
    // thì ví này đã "đủ phiếu" chỉ vì chủ ví hạ ngưỡng giữa chừng.
    expect((await requestOf(w.id))?.status).toBe("pending");
  });
});

describe("R6 nhóm C — lá thư 'đã đủ phiếu' phát ĐÚNG MỘT LẦN", () => {
  testIt("mốc pending → ready: chủ ví nhận đúng 2 dòng (email + sse), 0 push", async () => {
    const stream = freshStream();
    const w = await seedWallet(2);
    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(5)],
          1,
        ),
      ],
      stream,
    );
    expect(await notifyRows(w.ownerUserId, "recovery.threshold_met")).toHaveLength(0);

    await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);
    const rows = await notifyRows(w.ownerUserId, "recovery.threshold_met");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.channel).sort()).toEqual(["email", "sse"]);
    expect(rows.some((r) => r.channel === "push")).toBe(false);
  });

  testIt(
    "phiếu THỨ BA sau khi đã đủ → KHÔNG báo lần hai (gác nằm ở WHERE, không ở dedupe event)",
    async () => {
      const stream = freshStream();
      const w = await seedWallet(2);
      await apply(
        [
          registryEvent(
            "initiate",
            w.stellarAddress,
            [randomAddress(), new Uint8Array(32).fill(6)],
            1,
          ),
        ],
        stream,
      );
      await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);
      expect(await notifyRows(w.ownerUserId, "recovery.threshold_met")).toHaveLength(2);

      // Contract vẫn cho guardian thứ ba bỏ phiếu khi status đã Approved
      // (lib.rs:346) → event `approve` MỚI, id khác, dedupe PK không chặn.
      // Cái chặn ở đây là `status='pending'` trong WHERE của câu promote.
      await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 3], 3)], stream);
      expect(await notifyRows(w.ownerUserId, "recovery.threshold_met")).toHaveLength(2);
      const row = await requestOf(w.id);
      expect(row?.status).toBe("ready");
      expect(row?.approvals).toBe(3);
    },
  );

  testIt("guardian có tài khoản KHÔNG nhận email ở mốc này (chỉ chủ ví)", async () => {
    const stream = freshStream();
    const w = await seedWallet(2);
    const guardianUserId = `it-r6-guard-${crypto.randomUUID().slice(0, 8)}`;
    cleanupUserIds.push(guardianUserId);
    await db.insert(guardians).values({ walletId: w.id, userId: guardianUserId, status: "active" });

    await apply(
      [
        registryEvent(
          "initiate",
          w.stellarAddress,
          [randomAddress(), new Uint8Array(32).fill(7)],
          1,
        ),
      ],
      stream,
    );
    await apply([registryEvent("approve", w.stellarAddress, [randomAddress(), 2], 2)], stream);

    expect(await notifyRows(w.ownerUserId, "recovery.threshold_met")).toHaveLength(2);
    // Guardian nhận realtime (publishDomainEvent) chứ KHÔNG nhận thư: việc của họ
    // đã xong, thêm thư là làm loãng đúng lá thư chủ ví cần đọc.
    expect(await notifyRows(guardianUserId, "recovery.threshold_met")).toHaveLength(0);
  });
});

describe("R6 nhóm A3 — recovery.vetoed không được viết lại chuyện đã rồi", () => {
  testIt("dòng đã `executed` giữ nguyên; chỉ dòng đang mở bị đóng", async () => {
    const stream = freshStream();
    const contractId = randomAddress();
    const ownerUserId = `it-r6-veto-${crypto.randomUUID().slice(0, 8)}`;
    cleanupUserIds.push(ownerUserId);
    const [w] = await db
      .insert(wallets)
      .values({ userId: ownerUserId, stellarAddress: randomAddress("G"), contractId })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);

    // Một lần khôi phục ĐÃ XONG từ trước + một lần đang mở.
    const [done] = await db
      .insert(recoveryRequests)
      .values({ walletId: w.id, newOwner: "a".repeat(56), status: "executed" })
      .returning({ id: recoveryRequests.id });
    const [open] = await db
      .insert(recoveryRequests)
      .values({ walletId: w.id, newOwner: "b".repeat(56), status: "pending" })
      .returning({ id: recoveryRequests.id });
    if (!done || !open) throw new Error("request insert failed");

    const veto = { ...makeEvent("recovery.vetoed"), contractId };
    await pollOnce(fakeSource([{ events: [veto], cursor: "cur-r6v", latestLedger: 400 }]), stream);

    const rows = await db
      .select({ id: recoveryRequests.id, status: recoveryRequests.status })
      .from(recoveryRequests)
      .where(eq(recoveryRequests.walletId, w.id));
    expect(rows.find((r) => r.id === done.id)?.status).toBe("executed");
    expect(rows.find((r) => r.id === open.id)?.status).toBe("vetoed");
  });
});
