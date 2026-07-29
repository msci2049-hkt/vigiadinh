// Cửa đổi JWT ví → session app (lô passkey-là-chìa-khoá 29/07) — test ĐẦY ĐỦ
// qua handler Better Auth thật + Postgres + Dragonfly thật.
//
// Đây là lớp AUTH: mỗi ca dưới đây là một hàng rào có thật, gỡ ca nào là mở
// đúng lỗ đó ra production:
//   1. đổi thành công → session THẬT của CHỦ VÍ, scope đúng ví đã ký;
//   2. jti MỘT LẦN — token đổi rồi mà bị trộm là vô giá trị ở cửa này;
//   3. token Ôi (iat cũ) bị chối — trộm localStorage để dành không đổi được;
//   4. ver lệch (recovery đã xoay khoá) bị chối;
//   5. đang đăng nhập tài khoản KHÁC → 409 + email bị che;
//   6. scope: session passkey ví A KHÔNG hành động được trên ví B cùng user;
//   7. session email/OTP KHÔNG scope — không hồi quy đường cũ.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { env } from "@/env";
import { signWalletJwt } from "@/modules/sep45/jwt";
import type { WalletJwtClaims } from "@/modules/sep45/types";
import { walletPolicies } from "@/modules/wallets/infra/wallet-policies.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";

const dbUp = await pgReachable();
if (!dbUp) console.warn(SKIP_REASON);
const testIt = dbUp ? it : it.skip;

const ORIGIN = "http://localhost:5173";
const PASSWORD = "Str0ngPassw0rd!23";

/**
 * Better Auth rate-limit key theo IP (x-forwarded-for). app.request không có
 * socket nên MỌI test rơi chung một xô — file này tạo ~10 tài khoản + ~11 lần
 * đổi, vượt trần sign-up 3/60s và exchange 10/60s ngay. IP giả RIÊNG cho từng
 * request để không tự giẫm nhau và không đốt quota của authz-matrix chạy cùng
 * tiến trình. KHÔNG phải nới gate: production key theo IP thật.
 */
let ipCounter = 0;
function fakeIp(): string {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

const contractAddress = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `C${Buffer.from(b).toString("hex").toUpperCase().slice(0, 55)}`.slice(0, 56);
};

async function signUpAndIn(tag: string): Promise<{ userId: string; cookie: string }> {
  const email = `sep45x-${tag}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const headers = {
    "content-type": "application/json",
    origin: ORIGIN,
    "x-forwarded-for": fakeIp(),
  };
  const up = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: PASSWORD, name: `sep45x ${tag}` }),
  });
  if (up.status !== 200) throw new Error(`sign-up ${tag}: ${up.status}`);
  const { user } = (await up.json()) as { user: { id: string } };
  const inRes = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = (inRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) throw new Error(`sign-in ${tag} không có cookie`);
  return { userId: user.id, cookie };
}

const cleanupWallets: string[] = [];

async function makeWallet(userId: string): Promise<{ id: string; address: string; ver: number }> {
  const address = contractAddress();
  const [w] = await db
    .insert(wallets)
    .values({ userId, stellarAddress: address, contractId: address })
    .returning({ id: wallets.id, ver: wallets.jwtVersion });
  if (!w) throw new Error("insert wallet lỗi");
  cleanupWallets.push(w.id);
  return { id: w.id, address, ver: w.ver };
}

/** JWT ví THẬT — cùng hàm ký, cùng secret với /api/sep45/token. */
function walletToken(address: string, ver: number, over?: Partial<WalletJwtClaims>): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: WalletJwtClaims = {
    iss: "test",
    sub: address,
    iat: now,
    exp: now + 900,
    jti: crypto.randomUUID().replaceAll("-", ""),
    home_domain: "test",
    ver,
    ...over,
  };
  return signWalletJwt(env.BETTER_AUTH_SECRET, claims);
}

function exchange(token: string, cookie?: string) {
  return app.request("/api/auth/sep45/exchange", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-for": fakeIp(),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ token }),
  });
}

function sessionCookieOf(res: Response): string {
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter((c) => c && !c.endsWith("="))
    .join("; ");
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWallets) {
    await db.delete(walletPolicies).where(eq(walletPolicies.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id));
  }
});

describe("POST /api/auth/sep45/exchange", () => {
  testIt("JWT ví hợp lệ → session của CHỦ VÍ, scope đúng ví đã ký", async () => {
    const u = await signUpAndIn("ok");
    const w = await makeWallet(u.userId);
    const res = await exchange(walletToken(w.address, w.ver));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string }; wallet_id: string };
    expect(body.user.id).toBe(u.userId);
    expect(body.wallet_id).toBe(w.id);

    const cookie = sessionCookieOf(res);
    expect(cookie.length).toBeGreaterThan(0);
    const sess = await app.request("/api/auth/get-session", {
      headers: { origin: ORIGIN, cookie },
    });
    expect(sess.status).toBe(200);
    const data = (await sess.json()) as {
      user: { id: string } | null;
      session: { activeWalletId?: string | null } | null;
    };
    expect(data.user?.id).toBe(u.userId);
    expect(data.session?.activeWalletId).toBe(w.id);
  });

  testIt("cùng token đổi lần HAI → 403 WALLET_TOKEN_USED (jti một lần)", async () => {
    const u = await signUpAndIn("replay");
    const w = await makeWallet(u.userId);
    const token = walletToken(w.address, w.ver);
    expect((await exchange(token)).status).toBe(200);
    const second = await exchange(token);
    expect(second.status).toBe(403);
    expect(await second.text()).toContain("WALLET_TOKEN_USED");
  });

  testIt("token Ôi (iat quá 5 phút) → 403 WALLET_TOKEN_STALE", async () => {
    const u = await signUpAndIn("stale");
    const w = await makeWallet(u.userId);
    const now = Math.floor(Date.now() / 1000);
    const res = await exchange(walletToken(w.address, w.ver, { iat: now - 600, exp: now + 300 }));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("WALLET_TOKEN_STALE");
  });

  testIt("ver lệch (recovery đã xoay khoá) → 403 WALLET_SESSION_REVOKED", async () => {
    const u = await signUpAndIn("revoked");
    const w = await makeWallet(u.userId);
    const res = await exchange(walletToken(w.address, w.ver + 1));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("WALLET_SESSION_REVOKED");
  });

  testIt("ví không có trong DB → 403 WALLET_UNKNOWN", async () => {
    // ver phải khớp mới qua được resolveWalletSession — ví lạ chết ở đó trước,
    // cũng 4xx nhưng mã REVOKED/INVALID; ca này khoá đường ví BIẾN MẤT giữa
    // lúc phát token và lúc đổi (row bị xoá) → WALLET_UNKNOWN.
    const u = await signUpAndIn("ghost");
    const w = await makeWallet(u.userId);
    const token = walletToken(w.address, w.ver);
    await db.delete(wallets).where(eq(wallets.id, w.id));
    const res = await exchange(token);
    expect(res.status).toBe(403);
    // Sau khi xoá row, walletJwtVersion trả null → resolveWalletSession báo revoked.
    expect(await res.text()).toContain("WALLET_SESSION_REVOKED");
  });

  testIt("đang đăng nhập TÀI KHOẢN KHÁC → 409 + email bị che", async () => {
    const u1 = await signUpAndIn("cross1");
    const u2 = await signUpAndIn("cross2");
    const w2 = await makeWallet(u2.userId);
    const res = await exchange(walletToken(w2.address, w2.ver), u1.cookie);
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(text).toContain("WALLET_BELONGS_TO_OTHER_ACCOUNT:sep***@example.test");
  });

  testIt(
    "cùng user ký VÍ KHÁC của mình → session mới scope theo ví mới (đổi khoá B1)",
    async () => {
      const u = await signUpAndIn("switch");
      const wA = await makeWallet(u.userId);
      const wB = await makeWallet(u.userId);
      const resA = await exchange(walletToken(wA.address, wA.ver));
      expect(resA.status).toBe(200);
      const resB = await exchange(walletToken(wB.address, wB.ver), sessionCookieOf(resA));
      expect(resB.status).toBe(200);
      expect(((await resB.json()) as { wallet_id: string }).wallet_id).toBe(wB.id);
    },
  );
});

describe("scope ví trên cửa GHI (Q4 — passkey A không hành động được trên B)", () => {
  testIt("session passkey ví A: GET policy ví A 200 · ví B 403 WALLET_OUT_OF_SCOPE", async () => {
    const u = await signUpAndIn("scope");
    const wA = await makeWallet(u.userId);
    const wB = await makeWallet(u.userId);
    const res = await exchange(walletToken(wA.address, wA.ver));
    const cookie = sessionCookieOf(res);

    const okA = await app.request(`/api/wallets/${wA.id}/policy`, {
      headers: { origin: ORIGIN, cookie },
    });
    expect(okA.status).toBe(200);

    const denyB = await app.request(`/api/wallets/${wB.id}/policy`, {
      headers: { origin: ORIGIN, cookie },
    });
    expect(denyB.status).toBe(403);
    expect(await denyB.text()).toContain("WALLET_OUT_OF_SCOPE");
  });

  testIt("session EMAIL (không scope) vẫn đụng được cả hai ví — không hồi quy", async () => {
    const u = await signUpAndIn("legacy");
    const wA = await makeWallet(u.userId);
    const wB = await makeWallet(u.userId);
    for (const w of [wA, wB]) {
      const res = await app.request(`/api/wallets/${w.id}/policy`, {
        headers: { origin: ORIGIN, cookie: u.cookie },
      });
      expect(res.status).toBe(200);
    }
  });

  testIt("danh sách ví: ví ĐÃ ký đứng đầu (FE lấy wallets[0])", async () => {
    const u = await signUpAndIn("order");
    const wA = await makeWallet(u.userId);
    const wB = await makeWallet(u.userId);
    // Ký ví B (tạo SAU — mặc định danh sách có thể trả A trước).
    const res = await exchange(walletToken(wB.address, wB.ver));
    const cookie = sessionCookieOf(res);
    const list = await app.request("/api/wallets", { headers: { origin: ORIGIN, cookie } });
    const { data } = (await list.json()) as { data: Array<{ id: string }> };
    const ours = data.filter((w) => w.id === wA.id || w.id === wB.id);
    expect(ours[0]?.id).toBe(wB.id);
  });
});
