// Hàng rào luồng "Thêm vào ví" (bug 28/07) — ba điều phải đúng ở tầng HTTP thật:
//   1. Chủ ví KHÔNG tự nhận lời mời của chính mình được (GUARDIAN_IS_OWNER) —
//      tự làm guardian của mình là mất máy mất luôn "người cứu".
//   2. Cùng một danh tính không được "Thêm vào ví" hai lần (GUARDIAN_ALREADY_ADDED)
//      — mỗi nguyên nhân một MÃ, không còn câu lỗi chung.
//   3. "Thêm vào ví" phải GHI dòng `guardians` — trước đây không ai ghi bảng này
//      nên bước `register_wallet` không bao giờ đủ khoá.
// Phiên THẬT qua Better Auth (khuôn authz-matrix.integration.test.ts) — cookie
// tự chế thì cả suite chỉ chứng minh về một cái giả.
import { afterAll, describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { user } from "@/db/schema";
import { guardianInvites } from "@/modules/guardians/infra/guardian-invites.schema";
import { guardians } from "@/modules/guardians/infra/guardians.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON, sleep } from "@/test-support/pg";

const dbUp = await pgReachable();
if (!dbUp) console.warn(SKIP_REASON);
const testIt = dbUp ? it : it.skip;

const ORIGIN = "http://localhost:5173";
const PASSWORD = "Str0ngPassw0rd!23";

// Địa chỉ theo ĐÚNG bảng chữ base32 của Stellar — hex có 0/1/8/9 sẽ bị zod
// `^C[A-Z2-7]{55}$` của accept chối (400) trước khi chạm nghiệp vụ.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const contractAddress = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(55));
  let out = "C";
  for (const x of b) out += BASE32[x % 32];
  return out;
};

/** Sign-up bị limit 3/phút — chạy CẢ suite thì authz-matrix đã tiêu gần hết
 * quota, file này load sau sẽ dính 429. Đợi qua cửa sổ rồi thử lại (chạy ở
 * top-level nên không vướng timeout per-test). */
async function postAuth(path: string, body: unknown): Promise<Response> {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  for (let attempt = 0; ; attempt++) {
    const res = await app.request(path, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status !== 429 || attempt >= 3) return res;
    await sleep(21_000);
  }
}

async function signUp(tag: string): Promise<{ userId: string; cookie: string }> {
  const email = `invites-${tag}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const up = await postAuth("/api/auth/sign-up/email", {
    email,
    password: PASSWORD,
    name: `invites ${tag}`,
  });
  if (up.status !== 200) throw new Error(`sign-up ${tag} lỗi ${up.status}: ${await up.text()}`);
  const { user: u } = (await up.json()) as { user: { id: string } };
  const inRes = await postAuth("/api/auth/sign-in/email", { email, password: PASSWORD });
  if (inRes.status !== 200) {
    throw new Error(`sign-in ${tag} lỗi ${inRes.status}: ${await inRes.text()}`);
  }
  const cookie = (inRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) throw new Error(`sign-in ${tag} không trả cookie phiên`);
  return { userId: u.id, cookie };
}

function post(path: string, cookie: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, cookie },
    body: JSON.stringify(body),
  });
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

const cleanupWallets: string[] = [];
const cleanupUsers: string[] = [];

/** Lời mời mới toanh của ví — qua chính API tạo lời mời (đường thật). */
async function createInvite(cookie: string, walletId: string, label: string): Promise<string> {
  const res = await post("/api/guardians/invites", cookie, { wallet_id: walletId, label });
  if (res.status !== 200) throw new Error(`tạo invite lỗi ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as { data: { token: string } };
  return data.token;
}

let owner = { userId: "", cookie: "" };
let helper = { userId: "", cookie: "" };
let walletId = "";
let walletAddress = "";

if (dbUp) {
  owner = await signUp("owner");
  helper = await signUp("helper");
  cleanupUsers.push(owner.userId, helper.userId);
  walletAddress = contractAddress();
  const [w] = await db
    .insert(wallets)
    .values({ userId: owner.userId, stellarAddress: walletAddress, contractId: walletAddress })
    .returning({ id: wallets.id });
  walletId = w?.id ?? "";
  cleanupWallets.push(walletId);
}

afterAll(async () => {
  if (!dbUp) return;
  // wallets cascade sang guardian_invites + guardians.
  if (cleanupWallets.length > 0)
    await db.delete(wallets).where(inArray(wallets.id, cleanupWallets));
  if (cleanupUsers.length > 0) await db.delete(user).where(inArray(user.id, cleanupUsers));
});

describe("guardian invites — hàng rào tự-mình + trùng danh tính (HTTP thật)", () => {
  testIt("GET /invites/:token — không phiên: KHÔNG có viewer; chủ ví: is_owner=true", async () => {
    const token = await createInvite(owner.cookie, walletId, "Mẹ");
    const anon = await app.request(`/api/guardians/invites/${token}`, {
      headers: { origin: ORIGIN },
    });
    expect(anon.status).toBe(200);
    const anonBody = (await anon.json()) as { data: Record<string, unknown> };
    expect("viewer" in anonBody.data).toBe(false);

    const asOwner = await app.request(`/api/guardians/invites/${token}`, {
      headers: { origin: ORIGIN, cookie: owner.cookie },
    });
    const ownerBody = (await asOwner.json()) as {
      data: { viewer?: { is_owner: boolean; accepted_by_me: boolean } };
    };
    expect(ownerBody.data.viewer).toEqual({ is_owner: true, accepted_by_me: false });
  });

  testIt("chủ ví accept lời mời của CHÍNH ví mình → 409 GUARDIAN_IS_OWNER", async () => {
    const token = await createInvite(owner.cookie, walletId, "Tự mình");
    const res = await post(`/api/guardians/invites/${token}/accept`, owner.cookie, {
      guardian_address: contractAddress(),
    });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("GUARDIAN_IS_OWNER");
  });

  testIt(
    "accept → registered: ghi dòng guardians; viewer.accepted_by_me=true kèm owner_name",
    async () => {
      const token = await createInvite(owner.cookie, walletId, "Chị");
      const guardianAddress = contractAddress();
      const accepted = await post(`/api/guardians/invites/${token}/accept`, helper.cookie, {
        guardian_address: guardianAddress,
      });
      expect(accepted.status).toBe(200);

      // Link đã dùng, nhưng CHÍNH người nhận xem lại → biết "là tôi" + tên chủ ví.
      const revisit = await app.request(`/api/guardians/invites/${token}`, {
        headers: { origin: ORIGIN, cookie: helper.cookie },
      });
      const revisitBody = (await revisit.json()) as {
        data: { usable: boolean; owner_name?: string; viewer?: { accepted_by_me: boolean } };
      };
      expect(revisitBody.data.usable).toBe(false);
      expect(revisitBody.data.viewer?.accepted_by_me).toBe(true);
      expect(revisitBody.data.owner_name).toBe("invites owner");

      const [invite] = await db
        .select({ id: guardianInvites.id })
        .from(guardianInvites)
        .where(eq(guardianInvites.token, token));
      const registered = await post("/api/guardians/invites/registered", owner.cookie, {
        invite_id: invite?.id,
      });
      expect(registered.status).toBe(200);

      const rows = await db
        .select({
          onchainKey: guardians.onchainKey,
          userId: guardians.userId,
          status: guardians.status,
        })
        .from(guardians)
        .where(eq(guardians.walletId, walletId));
      expect(rows).toEqual([
        { onchainKey: guardianAddress, userId: helper.userId, status: "active" },
      ]);

      // Cùng danh tính nhận lời mời THỨ HAI rồi "Thêm vào ví" → mã riêng, không câu chung.
      const token2 = await createInvite(owner.cookie, walletId, "Chị (lần 2)");
      await post(`/api/guardians/invites/${token2}/accept`, helper.cookie, {
        guardian_address: guardianAddress,
      });
      const [invite2] = await db
        .select({ id: guardianInvites.id })
        .from(guardianInvites)
        .where(eq(guardianInvites.token, token2));
      const dup = await post("/api/guardians/invites/registered", owner.cookie, {
        invite_id: invite2?.id,
      });
      expect(dup.status).toBe(409);
      expect(await errorCode(dup)).toBe("GUARDIAN_ALREADY_ADDED");
    },
  );
});
