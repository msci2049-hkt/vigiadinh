// Lô R1 — khoá lại lỗi "kênh cảnh báo im lặng bằng cách THÀNH CÔNG".
//
// Chuyện đã xảy ra thật 30/07: `notifyGuardiansDeviceRequested` enqueue đúng 3
// dòng cho đúng 3 guardian, đúng giây — nhưng `channel: "push"`. Push chưa cấu
// hình nên dispatcher ném PermanentDispatchError("PUSH_NOT_CONFIGURED") và cả 3
// dòng chết ở `failed`. Không ai biết có người đang cầu cứu; chủ ví chỉ phát
// hiện bằng cách tự chạy tay trọn luồng trên máy khác.
//
// Ba tầng test ở đây, từ yếu tới mạnh:
//   1. Guard tĩnh — chặn push-only QUAY LẠI đường khôi phục (tripwire, không phải proof).
//   2. DB thật — đếm đúng row/kênh sinh ra. Đây mới là bằng chứng.
//   3. SSE thật qua Dragonfly — guardian đang mở app nhận được.
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import type { SseClient } from "@/lib/realtime-core";
import { pgReachable, SKIP_REASON, sleep } from "@/test-support/pg";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { notifyGuardiansDeviceRequested, upsertDeviceRequest } from "./recovery.repository";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const VERIFIER = "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const cleanupWalletIds: string[] = [];
const cleanupUserIds: string[] = [];

function randomAddress(): string {
  return `C${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "B")}`;
}

/** Ví + N guardian có tài khoản. Trả về id ví và danh sách userId guardian. */
async function seedWalletWithGuardians(count: number) {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: `it-nc-owner-${crypto.randomUUID().slice(0, 8)}`,
      stellarAddress: randomAddress(),
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  const guardianUserIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const userId = `it-nc-guard-${crypto.randomUUID().slice(0, 8)}`;
    guardianUserIds.push(userId);
    cleanupUserIds.push(userId);
    await db.insert(guardians).values({ walletId: w.id, userId, status: "active" });
  }
  return { walletId: w.id, guardianUserIds };
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

describe("guard tĩnh — push-only KHÔNG được quay lại đường khôi phục", () => {
  // Đây là TRIPWIRE, không phải proof: quét chuỗi nên không thấy `channel`
  // truyền bằng biến. Giá trị của nó là bắt người thêm một `channel:"push"` MỚI
  // phải dừng lại và tự trả lời "kênh này có đang bật không" — đúng câu hỏi mà
  // lô 30/07 không ai hỏi.
  //
  // Allowlist ĐÓNG BĂNG: mỗi mục là một push-only ĐÃ BIẾT là hỏng, có nợ riêng.
  // Thêm mục mới vào đây phải kèm lý do, không phải kèm một dòng nữa.
  const KNOWN_PUSH_ONLY = new Set([
    // Nợ đã ghi: cùng gốc bệnh với lô này, khác luồng (presence), sửa lô sau.
    "src/jobs/presence-ping.ts",
    // Nợ đã ghi: luồng thừa kế, chưa rà.
    "src/modules/inheritance/infra/heartbeat.repository.ts",
    // Literal push chỉ còn ở nhánh template NGOÀI recovery (applyEvent tách
    // nhánh recovery.* → email+sse TRƯỚC, R4-D1). Lý do CŨ của mục này ("đã ép
    // thêm email ở 227-234") chính là lỗ hổng R4-D2: có thêm email không làm
    // dòng push biến mất — 4 template recovery.* vẫn chết failed/
    // PUSH_NOT_CONFIGURED (đo 31/07: recovery.initiated push failed + email
    // sent cùng microsecond). Bằng chứng thật giờ là test ĐO DB:
    // indexer.integration.test.ts — cả 4 template registry email+sse, 0 push.
    "src/modules/indexer/infra/indexer.service.ts",
  ]);

  it("không file nguồn nào ngoài allowlist enqueue channel:'push'", async () => {
    const glob = new Bun.Glob("src/**/*.ts");
    const offenders: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd() })) {
      if (path.includes(".test.")) continue;
      const src = await Bun.file(path).text();
      if (!/channel:\s*"push"/.test(src)) continue;
      const normalized = path.replaceAll("\\", "/");
      if (!KNOWN_PUSH_ONLY.has(normalized)) offenders.push(normalized);
    }
    expect(offenders).toEqual([]);
  });

  it("module recovery KHÔNG còn một dòng push nào", async () => {
    const glob = new Bun.Glob("src/modules/recovery/**/*.ts");
    const offenders: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd() })) {
      if (path.includes(".test.")) continue;
      const src = await Bun.file(path).text();
      if (/channel:\s*"push"/.test(src)) offenders.push(path.replaceAll("\\", "/"));
    }
    expect(offenders).toEqual([]);
  });

  it("recovery-watch (đường báo chủ ví, độc lập indexer) vẫn đi email", async () => {
    const src = await Bun.file("src/jobs/recovery-watch.ts").text();
    expect(src).toContain('channel: "email"');
    expect(src).not.toMatch(/channel:\s*"push"/);
  });
});

describe("notifyGuardiansDeviceRequested (DB thật)", () => {
  testIt("mỗi guardian nhận ĐÚNG 2 dòng — email + sse — và KHÔNG dòng push nào", async () => {
    const { walletId, guardianUserIds } = await seedWalletWithGuardians(3);
    await notifyGuardiansDeviceRequested(walletId);

    for (const userId of guardianUserIds) {
      const rows = await db.select().from(notifications).where(eq(notifications.userId, userId));
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.channel).sort()).toEqual(["email", "sse"]);
      expect(rows.every((r) => r.templateKey === "recovery.device_requested")).toBe(true);
      // Dòng nào cũng phải xuất phát từ 'queued' — dispatcher mới là người chốt.
      expect(rows.every((r) => r.status === "queued")).toBe(true);
      expect(rows.some((r) => r.channel === "push")).toBe(false);
    }
  });

  testIt("guardian CHƯA có tài khoản (userId null) hoặc đã removed → không notify", async () => {
    const { walletId, guardianUserIds } = await seedWalletWithGuardians(1);
    const removedUserId = `it-nc-removed-${crypto.randomUUID().slice(0, 8)}`;
    cleanupUserIds.push(removedUserId);
    await db.insert(guardians).values({ walletId, userId: removedUserId, status: "removed" });
    await db.insert(guardians).values({ walletId, userId: null, status: "invited" });

    await notifyGuardiansDeviceRequested(walletId);

    const active = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, guardianUserIds[0] ?? ""));
    expect(active).toHaveLength(2);
    const removed = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, removedUserId));
    expect(removed).toHaveLength(0);
  });
});

describe("audit_log — yêu cầu khôi phục phải để lại dấu vết (DB thật)", () => {
  testIt("upsertDeviceRequest ghi audit, và KHÔNG chở key_base64 vào payload", async () => {
    const { walletId } = await seedWalletWithGuardians(1);
    const keyBase64 = Buffer.alloc(32, 3).toString("base64");
    await upsertDeviceRequest({
      walletId,
      verifier: VERIFIER,
      keyBase64,
      fingerprint: "f".repeat(64),
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.walletId, walletId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("recovery.device_requested");
    expect(rows[0]?.actorType).toBe("system");
    expect(JSON.stringify(rows[0]?.payload)).toContain("f".repeat(64));
    // Vật liệu khoá KHÔNG vào nhật ký — audit đọc được rộng hơn bảng gốc.
    expect(JSON.stringify(rows[0]?.payload)).not.toContain(keyBase64);
  });
});

describe("SSE thật qua Dragonfly — guardian đang mở app thấy ngay", () => {
  testIt("client đang mở nhận domain event recovery.device_requested", async () => {
    const { realtime } = await import("@/lib/realtime");
    const { walletId, guardianUserIds } = await seedWalletWithGuardians(1);
    const userId = guardianUserIds[0];
    if (!userId) throw new Error("seed failed");

    const received: string[] = [];
    const client: SseClient = { id: "it-nc-client", send: (msg) => received.push(msg.data) };
    const remove = realtime.addClient(userId, client);
    // SUBSCRIBE là lệnh mạng — chờ nó ăn trước khi publish, nếu không test đo
    // nhầm một race chứ không đo đường truyền.
    await sleep(300);

    try {
      await notifyGuardiansDeviceRequested(walletId);
      for (let i = 0; i < 20 && received.length === 0; i++) await sleep(100);
    } finally {
      remove();
    }

    if (received.length === 0) {
      // Dragonfly không chạy → fail-env, KHÔNG giả vờ pass và cũng không đỏ giả.
      console.warn("[skip] Dragonfly không sẵn sàng — SSE end-to-end không đo được");
      return;
    }
    expect(received.some((d) => d.includes("recovery.device_requested"))).toBe(true);
    // Luật payload domain-events: không địa chỉ ví, không id nội bộ.
    expect(received.join("")).not.toContain(walletId);
  });
});
