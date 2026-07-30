// Lô R1 — địa chỉ ví giờ ĐI QUA đường guardian, nên phải chứng minh nó chỉ đi
// tới ĐÚNG guardian của ví đó. Test key-list (domain.test.ts) chốt "trường nào
// rời BE"; test này chốt "rời BE tới TAY AI" — hai câu hỏi khác nhau, và câu
// thứ hai chỉ trả lời được trên DB thật vì nó là chuyện của mệnh đề WHERE.
//
// Ca dựng: mỗi test tự dựng 2 chủ ví + 2 ví + 2 guardian chéo nhau, id và địa
// chỉ SINH NGẪU NHIÊN theo từng lần gọi. Dùng hằng số dùng chung thì test thứ
// hai đâm vào `wallets_stellar_address_uq` của test thứ nhất — và cái đỏ đó nói
// về fixture chứ không nói gì về phân quyền.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { user } from "../../../../db/schema/auth";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { listProtectingForUser } from "../../infra/guardians.repository";
import { guardians } from "../../infra/guardians.schema";
import { protectingItemView } from "./domain";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const cleanupWalletIds: string[] = [];
const cleanupUserIds: string[] = [];

function uid(tag: string): string {
  return `it-sc-${tag}-${crypto.randomUUID().slice(0, 12)}`;
}

/** Địa chỉ ví hợp lệ (C + 55 base32), duy nhất mỗi lần gọi. */
function randomAddress(): string {
  const body = crypto
    .randomUUID()
    .replace(/-/g, "")
    .toUpperCase()
    .replace(/[0189]/g, "7");
  return `C${body.slice(0, 55).padEnd(55, "B")}`;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) await db.delete(wallets).where(eq(wallets.id, id));
  for (const id of cleanupUserIds) await db.delete(user).where(eq(user.id, id));
});

async function insertOwner(id: string, name: string): Promise<void> {
  cleanupUserIds.push(id);
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Một ví + một guardian của nó. Chủ ví phải tồn tại THẬT: listProtectingForUser
 * INNER JOIN bảng `user` để lấy tên/email chủ ví. */
async function seedPair(tag: string) {
  const ownerId = uid(`owner-${tag}`);
  const guardianUserId = uid(`guard-${tag}`);
  const address = randomAddress();
  await insertOwner(ownerId, `Chu vi ${tag}`);
  const [w] = await db
    .insert(wallets)
    .values({ userId: ownerId, stellarAddress: address })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values({ walletId: w.id, userId: guardianUserId, status: "active" });
  return { ownerId, guardianUserId, address, walletId: w.id };
}

describe("list-protecting — địa chỉ ví chỉ tới guardian CỦA ví đó (DB thật)", () => {
  testIt("A thấy địa chỉ ví-1; KHÔNG thấy ví-2 dưới bất kỳ dạng nào", async () => {
    const one = await seedPair("one");
    const two = await seedPair("two");

    const seenByA = (await listProtectingForUser(one.guardianUserId)).map(protectingItemView);
    expect(seenByA).toHaveLength(1);
    expect(seenByA[0]?.wallet_id).toBe(one.walletId);
    expect(seenByA[0]?.stellar_address).toBe(one.address);

    // Chốt bằng chuỗi thô: không chỉ "không có field", mà địa chỉ / id ví / id
    // chủ của ví-2 không xuất hiện ở BẤT KỲ đâu trong payload A nhận được.
    const payloadA = JSON.stringify(seenByA);
    expect(payloadA).not.toContain(two.address);
    expect(payloadA).not.toContain(two.walletId);
    expect(payloadA).not.toContain(two.ownerId);

    const seenByB = (await listProtectingForUser(two.guardianUserId)).map(protectingItemView);
    expect(seenByB).toHaveLength(1);
    expect(seenByB[0]?.stellar_address).toBe(two.address);
    expect(JSON.stringify(seenByB)).not.toContain(one.address);
  });

  testIt("guardian đã removed mất luôn quyền đọc địa chỉ", async () => {
    const pair = await seedPair("removed");
    expect(await listProtectingForUser(pair.guardianUserId)).toHaveLength(1);

    await db
      .update(guardians)
      .set({ status: "removed" })
      .where(eq(guardians.walletId, pair.walletId));

    const after = (await listProtectingForUser(pair.guardianUserId)).map(protectingItemView);
    expect(after).toHaveLength(0);
    expect(JSON.stringify(after)).not.toContain(pair.address);
  });

  testIt("người lạ (không gác ví nào) nhận danh sách rỗng", async () => {
    const pair = await seedPair("stranger");
    const stranger = await listProtectingForUser(uid("nobody"));
    expect(stranger).toHaveLength(0);
    expect(JSON.stringify(stranger)).not.toContain(pair.address);
  });
});
