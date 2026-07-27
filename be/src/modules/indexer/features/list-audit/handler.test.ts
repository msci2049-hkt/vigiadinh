import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/modules/indexer/infra/audit-log.schema";
import * as repo from "@/modules/indexer/infra/indexer.repository";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { decodeCursor, encodeCursor, listAuditQuery } from "./dto";

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
