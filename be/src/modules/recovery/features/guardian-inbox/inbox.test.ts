// Integration Postgres THẬT: hộp thư guardian chỉ trả yêu cầu ĐANG MỞ trên ví
// mà user là guardian hiệu lực — không lộ ví người lạ, không lộ chuyện đã đóng.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { openRequestsForGuardianUser } from "../../infra/recovery.repository";
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
