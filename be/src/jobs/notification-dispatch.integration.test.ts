// WHY: Chứng minh chuỗi VETO đã nối liền — không phải bằng mock, mà bằng email
// RỜI KHỎI PROCESS và nằm trong hộp thư thật (Mailhog).
//
// Trước bản vá: enqueueNotification() chỉ INSERT một dòng rồi hết; không consumer
// nào đọc bảng `notifications`. Test này fail trên bản đó vì hàm dispatcher không
// tồn tại — và kể cả khi có, Mailhog sẽ không nhận được gì.
//
// Hai điều được khoá ở đây:
//   1. Gửi ĐÚNG MỘT LẦN. Chạy tick lần hai KHÔNG gửi lại (idempotent) — thông báo
//      an ninh spam vào hộp thư là cách nhanh nhất để người dùng học cách phớt lờ nó.
//   2. Kênh chưa cấu hình FAIL RÕ RÀNG, không im lặng nuốt.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { client, db } from "@/db";
import { enqueueNotification } from "@/modules/notifications";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { runNotificationDispatchTick } from "./notification-dispatch";

const dbUp = await pgReachable();

// Mailhog phục vụ cả SMTP (SMTP_PORT) lẫn HTTP API. API để ĐỌC LẠI mail đã gửi —
// đây là chỗ biến "sendEmail không throw" thành "mail thật sự ra khỏi máy".
const MAILHOG_API = `http://localhost:${process.env.MAILHOG_UI_PORT ?? 44555}`;

async function mailhogUp(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILHOG_API}/api/v2/messages`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const mailUp = dbUp ? await mailhogUp() : false;
const ready = dbUp && mailUp;
const why = !dbUp ? SKIP_REASON : "[skip] Mailhog chưa chạy — docker compose up -d";

type MailhogItem = { Content: { Headers: Record<string, string[]> } };

async function mailsTo(address: string): Promise<MailhogItem[]> {
  const res = await fetch(`${MAILHOG_API}/api/v2/messages?limit=200`);
  const body = (await res.json()) as { items: MailhogItem[] };
  return body.items.filter((m) => (m.Content.Headers.To ?? []).some((t) => t.includes(address)));
}

const RUN_ID = crypto.randomUUID().slice(0, 8);
const USER_ID = `notif-disp-${RUN_ID}`;
const EMAIL = `${USER_ID}@example.test`;

beforeAll(async () => {
  if (!ready) return;
  // Bảng `user` của Better Auth — soft ref, tạo bằng SQL thô để không kéo cả
  // tầng auth vào test hạ tầng.
  await client`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${USER_ID}, 'Dispatch Probe', ${EMAIL}, true, now(), now())
    ON CONFLICT (id) DO NOTHING
  `;
});

afterAll(async () => {
  if (!ready) return;
  await db.execute(sql`DELETE FROM notifications WHERE user_id = ${USER_ID}`);
  await client`DELETE FROM "user" WHERE id = ${USER_ID}`;
});

describe.skipIf(!ready)(`dispatcher thông báo (email THẬT qua Mailhog) ${ready ? "" : why}`, () => {
  test("enqueue → tick → mail nằm trong hộp thư, và tick lần hai KHÔNG gửi lại", async () => {
    const row = await enqueueNotification({
      userId: USER_ID,
      templateKey: "recovery.initiated",
      params: { walletId: "W-probe", approvals: 1, hoursLeft: 48 },
      channel: "email",
    });
    expect(row.status).toBe("queued");

    const first = await runNotificationDispatchTick();

    // Kiểm last_error TRƯỚC: gửi hỏng thì diff in ra ĐÚNG lý do, thay vì chỉ
    // "expected 1, got 0" rồi phải đi dò.
    const [after] = (await db.execute(
      sql`SELECT status, sent_at, attempts, last_error FROM notifications WHERE id = ${row.id}`,
    )) as unknown as {
      status: string;
      sent_at: string | null;
      attempts: number;
      last_error: string | null;
    }[];
    expect(after?.last_error).toBeNull();
    expect(after?.status).toBe("sent");
    expect(after?.sent_at).not.toBeNull();
    expect(after?.attempts).toBe(1);
    expect(first.sent).toBeGreaterThanOrEqual(1);

    // BẰNG CHỨNG THẬT: mail ra khỏi process và nằm trong hộp thư.
    const afterFirst = await mailsTo(EMAIL);
    expect(afterFirst).toHaveLength(1);

    // IDEMPOTENT: chạy lại không được gửi thêm lần nào.
    await runNotificationDispatchTick();
    const afterSecond = await mailsTo(EMAIL);
    expect(afterSecond).toHaveLength(1);
  });

  test("kênh push chưa cấu hình → FAILED có lý do, KHÔNG im lặng bỏ qua", async () => {
    // Kênh cảnh báo mà người vận hành TƯỞNG đang chạy nguy hiểm hơn kênh biết rõ
    // là tắt — nên trạng thái phải đọc được bằng máy, không chỉ nằm trong log.
    const row = await enqueueNotification({
      userId: USER_ID,
      templateKey: "recovery.initiated",
      params: { walletId: "W-probe", approvals: 1, hoursLeft: 48 },
      channel: "push",
    });

    await runNotificationDispatchTick();

    const [after] = (await db.execute(
      sql`SELECT status, last_error FROM notifications WHERE id = ${row.id}`,
    )) as unknown as { status: string; last_error: string | null }[];
    expect(after?.status).toBe("failed");
    expect(after?.last_error).toBe("PUSH_NOT_CONFIGURED");
  });
});
