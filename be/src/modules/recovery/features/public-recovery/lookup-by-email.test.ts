// R4 nhóm C — cửa tra ví bằng email. Đây là test AN NINH quan trọng nhất của lô:
// response phải KHÔNG phân biệt được giữa "email có ví" và "email không tồn tại"
// theo MỌI trục đo được từ ngoài — status, body (byte-for-byte), thời gian.
// Route-level qua app.request (testing-be): đo đúng thứ kẻ dò nhìn thấy.
import { afterAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { rateLimitConnection } from "@/lib/redis";
import { pgReachable, SKIP_REASON, sleep } from "@/test-support/pg";
import { auditLog } from "../../../indexer/infra/audit-log.schema";
import { notifications } from "../../../notifications/infra/notifications.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { publicRecoveryRoute } from "./handler";

const dbUp = await pgReachable();

/** Rate-limit của route đi Dragonfly failOpen=false — không có Dragonfly thì
 * mọi request 429 STORE_DOWN. Đó là fail-env, không phải hành vi cần đo. */
async function redisUp(): Promise<boolean> {
  try {
    await Promise.race([
      rateLimitConnection.ping(),
      sleep(1500).then(() => {
        throw new Error("timeout");
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

const infraUp = dbUp && (await redisUp());
const testIt = infraUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);
else if (!infraUp) console.warn("[skip] Dragonfly không sẵn sàng — rate limit không đo được");

const app = new Hono().route("/", publicRecoveryRoute);
const RUN = crypto.randomUUID().slice(0, 8);
const OWNER_ID = `it-lk-owner-${RUN}`;
const OWNER_EMAIL = `it-lookup-${RUN}@example.com`;
const GHOST_EMAIL = `it-ghost-${RUN}@example.com`;
const cleanupWalletIds: string[] = [];

async function post(email: unknown, ip: string, rawBody?: string): Promise<Response> {
  return await app.request("/public/lookup-by-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: rawBody ?? JSON.stringify({ email }),
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function seedOwnerWallet(): Promise<string> {
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${OWNER_ID}, 'It Lookup', ${OWNER_EMAIL}, true, now(), now())
    ON CONFLICT (id) DO NOTHING
  `);
  const address = `C${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "B")}`;
  const [w] = await db
    .insert(wallets)
    .values({ userId: OWNER_ID, stellarAddress: address })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  return w.id;
}

afterAll(async () => {
  if (!dbUp) return;
  await db.delete(notifications).where(eq(notifications.userId, OWNER_ID));
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id));
  }
  await db.execute(sql`DELETE FROM "user" WHERE id = ${OWNER_ID}`);
});

describe("lookup-by-email — không phân biệt được có ví / không có ví", () => {
  testIt("hai nhánh trả 200 với body BYTE-FOR-BYTE giống hệt, không lộ địa chỉ ví", async () => {
    const walletId = await seedOwnerWallet();

    const hit = await post(OWNER_EMAIL, `it-eq-a-${RUN}`);
    const miss = await post(GHOST_EMAIL, `it-eq-b-${RUN}`);
    expect(hit.status).toBe(200);
    expect(miss.status).toBe(200);
    const hitText = await hit.text();
    const missText = await miss.text();
    expect(hitText).toBe(missText);
    // Response tuyệt đối KHÔNG chở địa chỉ ví (C… 56 ký tự) dưới bất kỳ dạng nào.
    expect(hitText).not.toMatch(/C[A-Z2-7]{55}/);

    // Nhánh "có ví": email chở link ĐƯỢC enqueue (fire-and-forget → chờ ngắn).
    let rows: { channel: string; params: unknown }[] = [];
    for (let i = 0; i < 20; i++) {
      rows = await db
        .select({ channel: notifications.channel, params: notifications.params })
        .from(notifications)
        .where(eq(notifications.userId, OWNER_ID));
      if (rows.length > 0) break;
      await sleep(100);
    }
    expect(rows).toHaveLength(1);
    expect(rows[0]?.channel).toBe("email");
    const link = (rows[0]?.params as { link?: string }).link ?? "";
    expect(link).toContain("/recovery/find-wallet?address=C");

    // C4: audit CẢ HAI lần tra — email có ví trỏ đúng ví, email lạ = unmatched;
    // payload chỉ sha256, KHÔNG email thô.
    const hitAudit = await db
      .select({ walletId: auditLog.walletId, payload: auditLog.payload })
      .from(auditLog)
      .where(eq(auditLog.kind, "recovery.wallet_lookup"));
    const mine = hitAudit.filter(
      (a) => (a.payload as { emailHash?: string }).emailHash === sha256(OWNER_EMAIL),
    );
    const ghost = hitAudit.filter(
      (a) => (a.payload as { emailHash?: string }).emailHash === sha256(GHOST_EMAIL),
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]?.walletId).toBe(walletId);
    expect(ghost).toHaveLength(1);
    expect(ghost[0]?.walletId).toBe("unmatched");
    expect(JSON.stringify(hitAudit)).not.toContain(OWNER_EMAIL);
  });

  testIt(
    "email sai định dạng / body rác → vẫn ĐÚNG response 200 đó (không lộ qua validate)",
    async () => {
      const good = await post(GHOST_EMAIL, `it-fmt-a-${RUN}`);
      const badFormat = await post("not-an-email", `it-fmt-b-${RUN}`);
      const notString = await post(42, `it-fmt-c-${RUN}`);
      const brokenJson = await post(null, `it-fmt-d-${RUN}`, "{not json");
      const expected = await good.text();
      for (const res of [badFormat, notString, brokenJson]) {
        expect(res.status).toBe(200);
        expect(await res.text()).toBe(expected);
      }
    },
  );

  testIt("C2 — chênh lệch thời gian giữa hai nhánh dưới ngưỡng (median 12 mẫu)", async () => {
    await seedOwnerWallet();
    const measure = async (email: string, tag: string): Promise<number[]> => {
      const out: number[] = [];
      for (let i = 0; i < 12; i++) {
        const t0 = performance.now();
        await post(email, `it-tm-${tag}-${i}-${RUN}`);
        out.push(performance.now() - t0);
      }
      return out.sort((a, b) => a - b);
    };
    // Warm-up cho cả hai đường (JIT + connection pool) trước khi đo.
    await post(OWNER_EMAIL, `it-tm-w1-${RUN}`);
    await post(GHOST_EMAIL, `it-tm-w2-${RUN}`);
    const hitTimes = await measure(OWNER_EMAIL, "hit");
    const missTimes = await measure(GHOST_EMAIL, "miss");
    const median = (xs: number[]) => xs[Math.floor(xs.length / 2)] ?? 0;
    const diff = Math.abs(median(hitTimes) - median(missTimes));
    // Ngưỡng 100ms: enqueue KHÔNG chặn response nên chênh thật cỡ ~1ms; ngưỡng
    // rộng để CI/WSL không đỏ giả, vẫn bắt được lỗi "await enqueue" (~50-300ms
    // cộng vào đúng một nhánh khi DB chậm, và là một mẫu THIÊN LỆCH HỆ THỐNG).
    console.info(
      `[timing] median hit=${median(hitTimes).toFixed(1)}ms miss=${median(missTimes).toFixed(1)}ms diff=${diff.toFixed(1)}ms`,
    );
    expect(diff).toBeLessThan(100);
  });

  testIt("rate limit: request thứ 6 cùng IP trong 60s bị 429", async () => {
    const ip = `it-rl-${RUN}`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await post(`rl-${i}-${GHOST_EMAIL}`, ip);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});
