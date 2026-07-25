// §3 (audit 2026-07-25) — MA TRẬN BOLA: hai tài khoản THẬT, mỗi route nhận ID.
//
// Vì sao file này tồn tại dù suite đã xanh 285 ca: BOLA không phát hiện được bằng
// test tĩnh hay quét động. Mọi ca cũ đều chạy dưới MỘT danh tính, nên chúng chứng
// minh "chủ ví đọc được ví mình" — không ca nào hỏi "người lạ có đọc được không".
// Đó đúng là câu hỏi mà OWASP xếp số 1 trong API Top 10.
//
// Cách kiểm chuẩn: hai tài khoản HỢP LỆ, verify mỗi bên không chạm được object của
// bên kia. Chỉ so `user_id` trong session với `id` trong param là KHÔNG đủ — trong
// BOLA thì kẻ tấn công ĐƯỢC PHÉP gọi endpoint đó, vi phạm nằm ở tầng object.
//
// Bảng route đầy đủ + chỗ kiểm ownership: docs/security/AUTHZ-MATRIX.md.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { guardianInvites } from "@/modules/guardians/infra/guardian-invites.schema";
import { guardians } from "@/modules/guardians/infra/guardians.schema";
import { transactionIntents } from "@/modules/intents/infra/intents.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";

const dbUp = await pgReachable();
if (!dbUp) console.warn(SKIP_REASON);

const ORIGIN = "http://localhost:5173";
// Địa chỉ contract hợp lệ, khác nhau mỗi lần chạy (cấm literal S.../trùng dữ liệu).
const contractAddress = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `C${Buffer.from(b).toString("hex").toUpperCase().slice(0, 55)}`.slice(0, 56);
};

type Account = { userId: string; cookie: string; walletId: string; address: string };

/**
 * Đăng ký + đăng nhập THẬT qua Better Auth, trả cookie phiên.
 *
 * Hai bước, không gộp: sign-up KHÔNG mở phiên (email verification bật —
 * `{"token":null}`, không Set-Cookie). Chỉ sign-in mới phát session cookie. Đây là
 * phiên THẬT qua đúng handler Better Auth, không phải cookie tự chế — nếu không thì
 * cả ma trận chỉ chứng minh được về một cái giả.
 */
const PASSWORD = "Str0ngPassw0rd!23";
async function signUp(tag: string): Promise<{ userId: string; cookie: string }> {
  const email = `authz-${tag}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const headers = { "content-type": "application/json", origin: ORIGIN };
  const up = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: PASSWORD, name: `authz ${tag}` }),
  });
  if (up.status !== 200) throw new Error(`sign-up ${tag} lỗi ${up.status}: ${await up.text()}`);
  const { user } = (await up.json()) as { user: { id: string } };

  const inRes = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (inRes.status !== 200) {
    throw new Error(`sign-in ${tag} lỗi ${inRes.status}: ${await inRes.text()}`);
  }
  const cookie = (inRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) throw new Error(`sign-in ${tag} không trả cookie phiên`);
  return { userId: user.id, cookie };
}

const cleanupWallets: string[] = [];

/** Dựng một tài khoản đầy đủ: user + ví + guardian + invite + intent của RIÊNG nó. */
async function makeAccount(
  tag: string,
): Promise<Account & { guardianId: string; intentId: string }> {
  const { userId, cookie } = await signUp(tag);
  const address = contractAddress();
  const [w] = await db
    .insert(wallets)
    .values({ userId, stellarAddress: address, contractId: address })
    .returning({ id: wallets.id });
  if (!w) throw new Error("insert wallet lỗi");
  cleanupWallets.push(w.id);

  const [g] = await db
    .insert(guardians)
    .values({ walletId: w.id, userId, status: "active", onchainKey: null })
    .returning({ id: guardians.id });
  const [i] = await db
    .insert(transactionIntents)
    .values({
      walletId: w.id,
      clientIntentId: `authz-${crypto.randomUUID().slice(0, 8)}`,
      operations: [{ kind: "transfer" }],
      status: "draft",
    })
    .returning({ id: transactionIntents.id });
  if (!g || !i) throw new Error("insert guardian/intent lỗi");

  return { userId, cookie, walletId: w.id, address, guardianId: g.id, intentId: i.id };
}

let A: Awaited<ReturnType<typeof makeAccount>>;
let B: Awaited<ReturnType<typeof makeAccount>>;
if (dbUp) {
  A = await makeAccount("a");
  B = await makeAccount("b");
}
const testIt = dbUp ? it : it.skip;

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWallets) {
    await db.delete(guardianInvites).where(eq(guardianInvites.walletId, id));
    await db.delete(transactionIntents).where(eq(transactionIntents.walletId, id));
    await db.delete(guardians).where(eq(guardians.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id));
  }
});

/** Gọi bằng danh tính A, nhắm object của B. */
const asA = (path: string, init?: RequestInit) =>
  app.request(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), origin: ORIGIN, cookie: A.cookie },
  });

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Bất biến THẬT: A không được nhận DỮ LIỆU của B. Hai cách đạt được, cả hai đúng:
 *
 *   a) 4xx — chối thẳng (403/404; 404 kín hơn vì không xác nhận object tồn tại);
 *   b) 200 với payload RỖNG — repo scope theo owner nên `WHERE user_id = A` không
 *      khớp dòng nào. Đây là hình dạng thật của phần lớn route trong repo này.
 *
 * Bản đầu của file này đòi "không được 200" và làm 6 route đỏ. Đo lại thì cả 6 trả
 * `{"data":[]}` cho A trong khi B nhận đúng dòng của mình — tức phòng thủ CÓ chạy,
 * chỉ là bằng cách (b). Siết thành lỗi là báo động giả, và báo động giả thì phiên
 * sau sẽ tắt test chứ không sửa code.
 *
 * Cái KHÔNG chấp nhận: 200 kèm nội dung. Và 5xx cũng không — sập vì ID người khác
 * nghĩa là ID đó đã đi sâu hơn tầng authz.
 */
async function expectNoLeak(label: string, res: Response): Promise<void> {
  const body = await res.text();
  if (res.status >= 500) throw new Error(`${label}: 5xx (${res.status}) — ID lạ đi quá sâu`);
  if (res.status !== 200) {
    expect(res.status).toBeGreaterThanOrEqual(400);
    return;
  }
  const parsed = JSON.parse(body) as { data?: unknown };
  const empty =
    parsed.data === null ||
    parsed.data === undefined ||
    (Array.isArray(parsed.data) && parsed.data.length === 0);
  if (!empty) throw new Error(`BOLA: ${label} trả 200 KÈM DỮ LIỆU của người khác: ${body}`);
}

describe("§3 BOLA — A không chạm được object của B (ĐỌC)", () => {
  testIt("GET /api/wallets/:id — ví của B", async () => {
    await expectNoLeak("GET /api/wallets/:id", await asA(`/api/wallets/${B.walletId}`));
  });

  testIt("GET /api/guardians/wallet/:walletId — guardian của B", async () => {
    await expectNoLeak(
      "GET /api/guardians/wallet/:walletId",
      await asA(`/api/guardians/wallet/${B.walletId}`),
    );
  });

  testIt("GET /api/guardians/invites/wallet/:walletId — invite của B", async () => {
    await expectNoLeak(
      "GET /api/guardians/invites/wallet/:walletId",
      await asA(`/api/guardians/invites/wallet/${B.walletId}`),
    );
  });

  testIt("GET /api/presence/guardian/:guardianId — trạng thái online guardian của B", async () => {
    // Bất biến 6 của dự án: trạng thái online guardian CHỈ chủ ví thấy.
    await expectNoLeak(
      "GET /api/presence/guardian/:guardianId",
      await asA(`/api/presence/guardian/${B.guardianId}`),
    );
  });

  testIt("GET /api/recovery/wallet/:walletId — yêu cầu khôi phục của B", async () => {
    await expectNoLeak(
      "GET /api/recovery/wallet/:walletId",
      await asA(`/api/recovery/wallet/${B.walletId}`),
    );
  });

  testIt("GET /api/recovery/chain-truth/:walletId — sự thật on-chain ví B", async () => {
    await expectNoLeak(
      "GET /api/recovery/chain-truth/:walletId",
      await asA(`/api/recovery/chain-truth/${B.walletId}`),
    );
  });

  testIt("GET /api/inheritance/wallet/:walletId — người thừa kế của B", async () => {
    await expectNoLeak(
      "GET /api/inheritance/wallet/:walletId",
      await asA(`/api/inheritance/wallet/${B.walletId}`),
    );
  });

  testIt("GET /api/inheritance/wallet/:walletId/plan — kế hoạch thừa kế của B", async () => {
    await expectNoLeak(
      "GET /api/inheritance/wallet/:walletId/plan",
      await asA(`/api/inheritance/wallet/${B.walletId}/plan`),
    );
  });

  testIt("GET /api/audit/wallet/:walletId — nhật ký ví B", async () => {
    await expectNoLeak(
      "GET /api/audit/wallet/:walletId",
      await asA(`/api/audit/wallet/${B.walletId}`),
    );
  });

  testIt("GET /api/wallets/:id/balance — số dư ví B (§8, endpoint mới)", async () => {
    // Endpoint đọc thêm ở phiên này phải vào ma trận NGAY, không đợi phiên sau —
    // route mới quên ownership chính là cách lỗ BOLA sinh ra.
    await expectNoLeak(
      "GET /api/wallets/:id/balance",
      await asA(`/api/wallets/${B.walletId}/balance`),
    );
  });

  testIt("GET /api/intents/send/:intentId/signable — intent của B", async () => {
    await expectNoLeak(
      "GET /api/intents/send/:intentId/signable",
      await asA(`/api/intents/send/${B.intentId}/signable`),
    );
  });
});

describe("§3 BOLA — A không chạm được object của B (GHI: đọc được thì tệ, ghi được thì mất tiền)", () => {
  testIt("PATCH /api/wallets/:id/recovery-config — đổi ngưỡng khôi phục ví B", async () => {
    // Ca tệ nhất trong bảng: hạ threshold ví người khác là mở cửa chiếm ví.
    await expectNoLeak(
      "PATCH /api/wallets/:id/recovery-config",
      await asA(`/api/wallets/${B.walletId}/recovery-config`, {
        ...json({ threshold: 1, timelock_secs: 0 }),
        method: "PATCH",
      }),
    );
  });

  testIt("POST /api/guardians/invites — mời guardian vào ví B", async () => {
    await expectNoLeak(
      "POST /api/guardians/invites",
      await asA("/api/guardians/invites", json({ wallet_id: B.walletId, label: "kẻ lạ" })),
    );
  });

  testIt("POST /api/intents — tạo intent trên ví B", async () => {
    await expectNoLeak(
      "POST /api/intents",
      await asA(
        "/api/intents",
        json({
          wallet_id: B.walletId,
          client_intent_id: crypto.randomUUID(),
          operations: [{ kind: "transfer" }],
        }),
      ),
    );
  });

  testIt("POST /api/intents/send/prepare — dựng lệnh gửi tiền từ ví B", async () => {
    await expectNoLeak(
      "POST /api/intents/send/prepare",
      await asA(
        "/api/intents/send/prepare",
        json({
          wallet_id: B.walletId,
          client_intent_id: crypto.randomUUID(),
          recipient: A.address,
          amount: "1000",
        }),
      ),
    );
  });

  testIt(
    "POST /api/inheritance/heartbeat — điểm danh hộ ví B (làm lệch đồng hồ thừa kế)",
    async () => {
      await expectNoLeak(
        "POST /api/inheritance/heartbeat",
        await asA("/api/inheritance/heartbeat", json({ wallet_id: B.walletId })),
      );
    },
  );

  testIt("POST /api/recovery/veto — phủ quyết trên ví B", async () => {
    await expectNoLeak(
      "POST /api/recovery/veto",
      await asA("/api/recovery/veto", json({ wallet_id: B.walletId })),
    );
  });

  testIt("POST /api/recovery/register — đăng ký khôi phục cho ví B", async () => {
    await expectNoLeak(
      "POST /api/recovery/register",
      await asA("/api/recovery/register", json({ wallet_id: B.walletId })),
    );
  });

  testIt("POST /api/recovery/addGuardian — thêm guardian vào ví B", async () => {
    await expectNoLeak(
      "POST /api/recovery/addGuardian",
      await asA(
        "/api/recovery/addGuardian",
        json({ wallet_id: B.walletId, guardian_address: A.address }),
      ),
    );
  });
});

describe("§3 — CHỨNG MINH NGƯỢC: chính B đọc được dữ liệu của B", () => {
  // Không có khối này thì cả ma trận vô giá trị: nếu fixture không tạo được dữ
  // liệu, A nhận `{"data":[]}` và mọi ca trên xanh vì KHÔNG CÓ GÌ ĐỂ RÒ. Ở đây ta
  // buộc cùng URL, cùng ID, đổi mỗi danh tính, phải trả ra dòng thật — nghĩa là
  // "rỗng với A" là kết quả của phòng thủ, không phải của một fixture chết.
  testIt("GET /api/guardians/wallet/:walletId bằng chính B → có dòng guardian", async () => {
    const res = await app.request(`/api/guardians/wallet/${B.walletId}`, {
      headers: { origin: ORIGIN, cookie: B.cookie },
    });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { id: string; walletId: string }[] };
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]?.walletId).toBe(B.walletId);
    expect(data.map((g) => g.id)).toContain(B.guardianId);
  });

  testIt("GET /api/wallets/:id bằng chính B → trả đúng ví B", async () => {
    const res = await app.request(`/api/wallets/${B.walletId}`, {
      headers: { origin: ORIGIN, cookie: B.cookie },
    });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { id: string } };
    expect(data.id).toBe(B.walletId);
  });
});

describe("§3 BOPLA (API3) — field nhạy cảm client gửi lên phải bị bỏ, không được nhận", () => {
  testIt("POST /api/wallets kèm jwt_version/user_id/role → KHÔNG ghi vào DB", async () => {
    const addr = contractAddress();
    const res = await asA(
      "/api/wallets",
      json({
        stellar_address: addr,
        contract_id: addr,
        // Ba field server sở hữu. Zod mặc định STRIP (không phải reject) — nên
        // điều phải chứng minh là chúng không LỌT XUỐNG DB, chứ không phải 400.
        jwt_version: 99,
        user_id: B.userId,
        role: "admin",
      }),
    );
    if (res.status === 200) {
      const [row] = await db
        .select({ userId: wallets.userId, ver: wallets.jwtVersion })
        .from(wallets)
        .where(eq(wallets.stellarAddress, addr));
      if (row) cleanupWallets.push(addr);
      // Ví phải thuộc A (người gọi), KHÔNG phải B mà body khai.
      expect(row?.userId).toBe(A.userId);
      // jwt_version là số hiệu thu hồi phiên — client đặt được nó là hồi sinh
      // được token đã chết (§1.2).
      expect(row?.ver).toBe(0);
      await db.delete(wallets).where(eq(wallets.stellarAddress, addr));
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe("§3 — mọi route trong bảng đều đòi đăng nhập (không token = 401)", () => {
  const authed = [
    "/api/wallets",
    `/api/wallets/${"0".repeat(26)}`,
    `/api/guardians/wallet/${"0".repeat(26)}`,
    `/api/presence/guardian/${"0".repeat(26)}`,
    `/api/recovery/wallet/${"0".repeat(26)}`,
    `/api/inheritance/wallet/${"0".repeat(26)}`,
    `/api/audit/wallet/${"0".repeat(26)}`,
    "/api/notifications",
    "/api/recovery/guardian",
  ];
  for (const path of authed) {
    testIt(`GET ${path} không kèm session → 401`, async () => {
      const res = await app.request(path, { headers: { origin: ORIGIN } });
      expect(res.status).toBe(401);
    });
  }
});
