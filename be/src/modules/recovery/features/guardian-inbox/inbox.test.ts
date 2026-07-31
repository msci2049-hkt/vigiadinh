// Integration Postgres THẬT: hộp thư guardian chỉ trả yêu cầu ĐANG MỞ trên ví
// mà user là guardian hiệu lực — không lộ ví người lạ, không lộ chuyện đã đóng.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { openRequestsForGuardianUser } from "../../infra/guardian-inbox.repository";
import { recoveryRequests } from "../../infra/recovery-requests.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const GUARDIAN_USER = `it-gi-guard-${crypto.randomUUID().slice(0, 8)}`;
const REMOVED_USER = `it-gi-removed-${crypto.randomUUID().slice(0, 8)}`;
const STRANGER = `it-gi-stranger-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

async function seedWalletWithRequest(input: {
  ownerUser: string;
  status: string;
  guardianStatus?: string;
}): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: input.ownerUser,
      stellarAddress: `C${crypto
        .randomUUID()
        .replace(/-/g, "")
        .toUpperCase()
        .slice(0, 55)
        .padEnd(55, "A")}`,
      threshold: 2,
      timelockSecs: 3600,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values({
    walletId: w.id,
    userId: input.guardianStatus === "removed" ? REMOVED_USER : GUARDIAN_USER,
    status: input.guardianStatus ?? "active",
  });
  await db.insert(recoveryRequests).values({
    walletId: w.id,
    newOwner: "a".repeat(56),
    status: input.status,
    approvals: 1,
    threshold: 2,
  });
  return w.id;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn guardians + requests
  }
});

describe("guardian inbox", () => {
  testIt(
    "chỉ yêu cầu MỞ trên ví mình bảo hộ; vetoed/executed + guardian removed loại hết",
    async () => {
      const openId = await seedWalletWithRequest({ ownerUser: "o1", status: "pending" });
      await seedWalletWithRequest({ ownerUser: "o2", status: "vetoed" });
      await seedWalletWithRequest({ ownerUser: "o3", status: "executed" });
      await seedWalletWithRequest({
        ownerUser: "o4",
        status: "pending",
        guardianStatus: "removed",
      });

      const mine = await openRequestsForGuardianUser(GUARDIAN_USER);
      const ids = mine.map((i) => i.wallet.id);
      expect(ids).toContain(openId);
      // Trong 4 ví vừa seed, chỉ ví openId lọt vào inbox của guardian này.
      const seeded = ids.filter((id) => cleanupWalletIds.includes(id));
      expect(seeded).toEqual([openId]);
      const item = mine.find((i) => i.wallet.id === openId);
      expect(item?.request.status).toBe("pending");
      expect(item?.wallet.threshold).toBe(2);

      // Người lạ: không thấy gì trong các ví vừa seed.
      const strangers = await openRequestsForGuardianUser(STRANGER);
      expect(strangers.filter((i) => cleanupWalletIds.includes(i.wallet.id))).toHaveLength(0);
    },
  );
});

// ── R6 nhóm E — "người ĐANG XEM đã ký chưa" ────────────────────────────────────
// Không có trường này thì màn ký sáng đèn cho cả người đã ký: họ bấm, chạm vân
// tay, BE build+simulate, rồi mới ăn `CONTRACT_ERROR:AlreadyApproved` — báo lỗi
// sau khi đã bắt người ta trả giá.
const A_USER = `it-r6e-a-${crypto.randomUUID().slice(0, 8)}`;
const B_USER = `it-r6e-b-${crypto.randomUUID().slice(0, 8)}`;

/** Địa chỉ hợp lệ theo ADDRESS_RE của domain/approvers (base32 Stellar). */
function onchainAddress(fill: string): string {
  return `C${fill.repeat(55).slice(0, 55)}`;
}
const A_KEY = onchainAddress("A");
const B_KEY = onchainAddress("B");

describe("R6 — viewerApproved", () => {
  testIt("true cho người ĐÃ ký, false cho người CHƯA ký, và không lộ chéo", async () => {
    const [w] = await db
      .insert(wallets)
      .values({
        userId: `it-r6e-owner-${crypto.randomUUID().slice(0, 8)}`,
        stellarAddress: onchainAddress("D"),
        threshold: 2,
        timelockSecs: 86_400,
      })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);

    // A và B cùng bảo hộ ví; CHỈ A đã bỏ phiếu (nằm trong signals.approvers).
    await db
      .insert(guardians)
      .values({ walletId: w.id, userId: A_USER, onchainKey: A_KEY, status: "active" });
    await db
      .insert(guardians)
      .values({ walletId: w.id, userId: B_USER, onchainKey: B_KEY, status: "active" });
    await db.insert(recoveryRequests).values({
      walletId: w.id,
      newOwner: "c".repeat(56),
      status: "pending",
      approvals: 1,
      threshold: 2,
      signals: { approvers: [{ guardian: A_KEY, txHash: "a".repeat(64) }] },
    });

    const [seenByA] = (await openRequestsForGuardianUser(A_USER)).filter(
      (i) => i.wallet.id === w.id,
    );
    const [seenByB] = (await openRequestsForGuardianUser(B_USER)).filter(
      (i) => i.wallet.id === w.id,
    );
    expect(seenByA?.viewerApproved).toBe(true);
    // B chưa ký → phải là FALSE. Nếu trường này chỉ phản chiếu "có ai đó đã ký"
    // thì B cũng thấy true và bị chặn khỏi màn ký oan — lộ chéo theo hướng ngược.
    expect(seenByB?.viewerApproved).toBe(false);
  });

  testIt("guardian CHƯA có khoá on-chain → false (không đoán bừa là đã ký)", async () => {
    const noKeyUser = `it-r6e-nokey-${crypto.randomUUID().slice(0, 8)}`;
    const [w] = await db
      .insert(wallets)
      .values({
        userId: `it-r6e-owner2-${crypto.randomUUID().slice(0, 8)}`,
        stellarAddress: onchainAddress("E"),
        threshold: 2,
      })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);
    await db
      .insert(guardians)
      .values({ walletId: w.id, userId: noKeyUser, onchainKey: null, status: "invited" });
    await db.insert(recoveryRequests).values({
      walletId: w.id,
      newOwner: "d".repeat(56),
      status: "ready",
      approvals: 2,
      threshold: 2,
      signals: { approvers: [{ guardian: A_KEY, txHash: "b".repeat(64) }] },
    });

    const [seen] = (await openRequestsForGuardianUser(noKeyUser)).filter(
      (i) => i.wallet.id === w.id,
    );
    expect(seen?.viewerApproved).toBe(false);
    // `ready` vẫn nằm trong hộp thư (để hiện "đủ phiếu, đang chờ"), không biến mất.
    expect(seen?.request.status).toBe("ready");
  });
});
