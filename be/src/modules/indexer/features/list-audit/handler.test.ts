import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/modules/indexer/infra/audit-log.schema";
import * as repo from "@/modules/indexer/infra/indexer.repository";
import { transactionIntents } from "@/modules/intents/infra/intents.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { auditItemView, decodeCursor, encodeCursor, listAuditQuery } from "./dto";

describe("indexer dto", () => {
  it("limit mặc định 50, coerce từ query string", () => {
    expect(listAuditQuery.parse({})).toEqual({ limit: 50 });
    expect(listAuditQuery.parse({ limit: "25" })).toEqual({ limit: 25 });
  });

  it("cursor roundtrip giữ nguyên mốc + id", () => {
    const at = new Date("2026-07-25T10:20:30.400Z");
    const decoded = decodeCursor(encodeCursor({ at, id: "01KYCS0TNDVZTS2S9Z95N20DNM" }));
    expect(decoded?.at.toISOString()).toBe(at.toISOString());
    expect(decoded?.id).toBe("01KYCS0TNDVZTS2S9Z95N20DNM");
  });

  it("auditItemView: bigint stroops → CHUỖI, JSON.stringify không throw", () => {
    // Trả thẳng bigint ra `c.json()` là lặp lại đúng lớp lỗi đã làm indexer chết
    // cứng 48 phút (2026-07-30). Gác ở đây vì handler là chỗ duy nhất còn lối ra.
    const row = {
      id: "01KYRQ07WMTARAZFP7SFWJ8SP5",
      walletId: "01KYRQ07WMTARAZFP7SFWJ8SP5",
      kind: "intent.settled",
      payload: { intentId: "01KYRYHCX302N1750BRDTKN7FT" },
      actorType: "owner",
      actorId: "u-1",
      deviceId: null,
      beforeHash: null,
      afterHash: null,
      at: new Date("2026-07-30T07:24:00.000Z"),
      intentAmount: 650_000_000n,
      intentRecipient: `C${"B".repeat(55)}`,
    };
    const view = auditItemView(row);
    expect(view.amount).toBe("650000000");
    expect(view.recipient).toBe(`C${"B".repeat(55)}`);
    expect(() => JSON.stringify(view)).not.toThrow();
    expect(() => JSON.stringify(row)).toThrow(); // bản chưa qua view thì chết
    // Trường cũ giữ nguyên — không thu hẹp hợp đồng đang chạy.
    expect(view.kind).toBe("intent.settled");
    expect(view.at).toEqual(row.at);
    expect("intentAmount" in view).toBe(false);
  });

  it("auditItemView: không có lệnh gửi → amount/recipient null (không phải chuỗi rỗng)", () => {
    const view = auditItemView({
      id: "01KYRQ07WMTARAZFP7SFWJ8SP6",
      walletId: "01KYRQ07WMTARAZFP7SFWJ8SP5",
      kind: "register",
      payload: { method: "register_wallet" },
      actorType: "system",
      actorId: null,
      deviceId: null,
      beforeHash: null,
      afterHash: null,
      at: new Date("2026-07-30T10:49:00.000Z"),
      intentAmount: null,
      intentRecipient: null,
    });
    expect(view.amount).toBeNull();
    expect(view.recipient).toBeNull();
  });

  it("cursor rác → null (handler map sang 400, KHÔNG âm thầm về trang đầu)", () => {
    // Rơi về trang đầu là bẫy vòng lặp vô hạn: client lật trang mãi không hết.
    expect(decodeCursor("khong-phai-base64!!")).toBeNull();
    expect(decodeCursor(Buffer.from('{"at":"nope","id":"x"}').toString("base64url"))).toBeNull();
    // id không đúng khuôn ULID → chối trước khi thành tham số truy vấn.
    expect(
      decodeCursor(
        Buffer.from(JSON.stringify({ at: new Date().toISOString(), id: "'; DROP--" })).toString(
          "base64url",
        ),
      ),
    ).toBeNull();
  });
});

// §6.5 — nhật ký ví phải ĐỌC ĐƯỢC QUÁ 100 dòng mới nhất.
//
// Bản cũ: `LIMIT 100`, không con trỏ. Ví dùng vài tháng thì mọi thứ cũ hơn 100 dòng
// gần nhất không còn đường nào chạm tới. Với bảng append-only của một cái ví, đó là
// lỗi CHỨC NĂNG — "xem lại giao dịch tháng trước" chính là lý do bảng này tồn tại.
const dbUp = await pgReachable();
if (!dbUp) console.warn(SKIP_REASON);
const testIt = dbUp ? it : it.skip;

const OWNER = `it-page-${crypto.randomUUID().slice(0, 8)}`;
let walletId = "";
const TOTAL = 7;

if (dbUp) {
  const addr = `C${Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
    .toString("hex")
    .toUpperCase()}`.slice(0, 56);
  const [w] = await db
    .insert(wallets)
    .values({ userId: OWNER, stellarAddress: addr, contractId: addr })
    .returning({ id: wallets.id });
  walletId = w?.id ?? "";
  // Mốc `at` cách nhau rõ ràng để thứ tự xác định, không phụ thuộc độ phân giải đồng hồ.
  for (let i = 0; i < TOTAL; i++) {
    await db.insert(auditLog).values({
      walletId,
      kind: `test.page-${i}`,
      actorType: "system",
      payload: { i },
      at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    });
  }
}

afterAll(async () => {
  if (!dbUp || !walletId) return;
  // Dòng audit KHÔNG dọn được, và đó là ĐÚNG. Hai tầng cùng chối:
  //   - REVOKE (0009 + §1.1) — role runtime không có DELETE;
  //   - trigger append-only (0002) — chối cả OWNER:
  //       PostgresError: audit_log is append-only (A7): DELETE blocked
  // Cách duy nhất để test tự dọn là gỡ một trong hai, tức phá đúng thứ phiên này
  // vừa dựng. Vài dòng test ở lại trong nhật ký là cái giá đúng: `walletId` mới mỗi
  // lần chạy nên không ca nào nhiễu ca nào. Chỉ dọn bảng `wallets` (không FK sang
  // audit_log — schema dùng soft ref, kiểm ở audit-log.schema.ts:16).
  await db.delete(wallets).where(eq(wallets.id, walletId));
});

describe("§6.5 — phân trang con trỏ cho nhật ký ví", () => {
  testIt("lật hết mọi trang thì thấy ĐỦ dòng, không trùng không sót", async () => {
    const seen: string[] = [];
    let cursor: { at: Date; id: string } | undefined;
    // Trang 2 dòng → cần 4 vòng cho 7 dòng. Trần 10 để lỗi thành đỏ, không thành treo.
    for (let guard = 0; guard < 10; guard++) {
      const page = await repo.listByWalletForOwner(walletId, OWNER, 2, cursor);
      seen.push(...page.items.map((r) => r.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    // Bản cũ trả tối đa `limit` dòng và KHÔNG có đường đi tiếp → seen.length === 2.
    expect(seen.length).toBe(TOTAL);
    expect(new Set(seen).size).toBe(TOTAL);
  });

  testIt("trang cuối trả nextCursor = null (biết khi nào dừng)", async () => {
    const page = await repo.listByWalletForOwner(walletId, OWNER, TOTAL + 5);
    expect(page.items.length).toBe(TOTAL);
    expect(page.nextCursor).toBeNull();
  });

  testIt("con trỏ KHÔNG phá scope owner — người lạ vẫn không đọc được", async () => {
    // Con trỏ hợp lệ do chủ ví lấy được, đem sang danh tính khác: vẫn rỗng. Phân
    // trang không được trở thành đường vòng qua tầng authz (§3).
    const first = await repo.listByWalletForOwner(walletId, OWNER, 2);
    expect(first.nextCursor).not.toBeNull();
    const stranger = await repo.listByWalletForOwner(
      walletId,
      "it-stranger-user",
      2,
      first.nextCursor ?? undefined,
    );
    expect(stranger.items).toHaveLength(0);
    expect(stranger.nextCursor).toBeNull();
  });
});

// ── B3: nhật ký phải chở SỐ TIỀN + NGƯỜI NHẬN ───────────────────────────────────
//
// `audit_log.payload` chỉ có `hash` + `status` + `intentId`; số tiền và người nhận
// nằm ở `transaction_intents`. Trước bản này API không join → lịch sử đọc được
// nhưng thiếu đúng hai thứ người dùng cần biết.
//
// 🔴 Ca quan trọng nhất ở đây KHÔNG phải "có join" mà là "join KHÔNG rò rỉ": hai
// ví khác chủ, payload của ví B trỏ vào intentId của ví A. `transaction_intents.id`
// là ULID duy nhất toàn cục nên nếu thiếu điều kiện cùng `wallet_id`, ví B sẽ đọc
// được số tiền + địa chỉ người nhận của ví A.
const OWNER_A = `it-b3a-${crypto.randomUUID().slice(0, 8)}`;
const OWNER_B = `it-b3b-${crypto.randomUUID().slice(0, 8)}`;
let walletA = "";
let walletB = "";
let intentA = "";

function fakeAddress(fill: string): string {
  return `C${fill.repeat(55)}`.slice(0, 56);
}

if (dbUp) {
  const [wa] = await db
    .insert(wallets)
    .values({ userId: OWNER_A, stellarAddress: fakeAddress("A"), contractId: fakeAddress("A") })
    .returning({ id: wallets.id });
  const [wb] = await db
    .insert(wallets)
    .values({ userId: OWNER_B, stellarAddress: fakeAddress("B"), contractId: fakeAddress("B") })
    .returning({ id: wallets.id });
  walletA = wa?.id ?? "";
  walletB = wb?.id ?? "";

  // Lệnh gửi THẬT của ví A: 65 XLM (650000000 stroops) → CBYKUI…SYDI.
  const [intent] = await db
    .insert(transactionIntents)
    .values({
      walletId: walletA,
      clientIntentId: `cli-${crypto.randomUUID()}`,
      status: "settled",
      operations: [{ type: "transfer" }],
      recipient: "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI",
      amount: 650_000_000n,
    })
    .returning({ id: transactionIntents.id });
  intentA = intent?.id ?? "";

  await db.insert(auditLog).values([
    // Ví A — dòng có lệnh gửi (join phải ra số tiền).
    {
      walletId: walletA,
      kind: "intent.settled",
      actorType: "owner",
      payload: { intentId: intentA, hash: "d".repeat(64), status: "SUCCESS" },
      at: new Date(Date.UTC(2026, 6, 30, 7, 24, 0)),
    },
    // Ví A — dòng KHÔNG có lệnh gửi (LEFT JOIN phải giữ lại).
    {
      walletId: walletA,
      kind: "register",
      actorType: "system",
      payload: { method: "register_wallet", hash: "e".repeat(64) },
      at: new Date(Date.UTC(2026, 6, 30, 7, 20, 0)),
    },
    { walletId: walletA, kind: "policy.change_applied", actorType: "system", payload: {} },
    { walletId: walletA, kind: "guardian.approved", actorType: "guardian", payload: null },
    // 🔴 Ví B — payload TRỎ VÀO intent của ví A. Đây là mũi tấn công.
    {
      walletId: walletB,
      kind: "intent.settled",
      actorType: "owner",
      payload: { intentId: intentA, hash: "f".repeat(64), status: "SUCCESS" },
      at: new Date(Date.UTC(2026, 6, 30, 8, 0, 0)),
    },
  ]);
}

afterAll(async () => {
  if (!dbUp) return;
  // wallets → transaction_intents cascade; audit_log là append-only (không dọn được,
  // và đó là đúng — mỗi lần chạy dùng walletId mới nên không ca nào nhiễu ca nào).
  for (const id of [walletA, walletB]) {
    if (id) await db.delete(wallets).where(eq(wallets.id, id));
  }
});

describe("B3 — join transaction_intents vào nhật ký", () => {
  testIt("dòng có intentId → amount stroops + địa chỉ người nhận đầy đủ", async () => {
    const page = await repo.listByWalletForOwner(walletA, OWNER_A, 50);
    const settled = page.items.find((r) => r.kind === "intent.settled");
    expect(settled).toBeDefined();
    expect(settled?.intentAmount).toBe(650_000_000n);
    expect(settled?.intentRecipient).toBe(
      "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI",
    );
    // Qua view thì thành chuỗi — 650000000 stroops = 65 XLM.
    expect(settled && auditItemView(settled).amount).toBe("650000000");
  });

  testIt(
    "🔴 KHÔNG rò rỉ chéo ví: ví B trỏ vào intentId của ví A → amount/recipient NULL",
    async () => {
      const page = await repo.listByWalletForOwner(walletB, OWNER_B, 50);
      const row = page.items.find((r) => r.kind === "intent.settled");
      // Dòng của chính ví B vẫn phải TRẢ VỀ (không bị join làm mất)...
      expect(row).toBeDefined();
      // ...nhưng chi tiết tiền của ví A thì KHÔNG được sang.
      expect(row?.intentAmount).toBeNull();
      expect(row?.intentRecipient).toBeNull();
      // Và không dòng nào của ví B chở số tiền của ví A.
      expect(page.items.every((r) => r.intentAmount === null)).toBe(true);
    },
  );

  testIt("LEFT JOIN: register / policy.change_applied / guardian.approved vẫn trả về", async () => {
    const page = await repo.listByWalletForOwner(walletA, OWNER_A, 50);
    const kinds = page.items.map((r) => r.kind);
    for (const kind of ["register", "policy.change_applied", "guardian.approved"]) {
      expect(kinds, `${kind} bị inner join xoá mất`).toContain(kind);
      expect(page.items.find((r) => r.kind === kind)?.intentAmount).toBeNull();
    }
    // 4 dòng của ví A, không nhân bản do join.
    expect(page.items).toHaveLength(4);
  });

  testIt("payload dị dạng (mảng / scalar / null) không làm sập truy vấn", async () => {
    // `jsonb ->> 'intentId'` trên mảng/scalar/NULL trả NULL chứ không lỗi — đã đo
    // trên Postgres thật. Ca này khoá lại điều đó để không ai đổi sang `->` rồi
    // biến một dòng payload lạ thành 500 cho cả trang nhật ký.
    await db.insert(auditLog).values([
      { walletId: walletA, kind: "test.b3-array", actorType: "system", payload: [1, 2] },
      { walletId: walletA, kind: "test.b3-scalar", actorType: "system", payload: "abc" },
    ]);
    const page = await repo.listByWalletForOwner(walletA, OWNER_A, 50);
    expect(page.items.map((r) => r.kind)).toContain("test.b3-array");
    expect(page.items.find((r) => r.kind === "test.b3-scalar")?.intentAmount).toBeNull();
  });

  testIt("con trỏ trang vẫn đúng sau khi thêm join (không nhân dòng, không sót)", async () => {
    const seen: string[] = [];
    let cursor: { at: Date; id: string } | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await repo.listByWalletForOwner(walletA, OWNER_A, 2, cursor);
      seen.push(...page.items.map((r) => r.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(new Set(seen).size).toBe(seen.length); // không dòng nào lặp
    expect(seen.length).toBe(6); // 4 dòng gốc + 2 dòng payload dị dạng
  });
});
