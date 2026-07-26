// DISPATCHER THÔNG BÁO — mắt xích cuối của cơ chế VETO.
//
// Vì sao job này tồn tại: trước nó, `enqueueNotification()` chỉ INSERT một dòng
// vào bảng `notifications` rồi HẾT. Không consumer nào đọc bảng đó. `sendEmail`
// có đúng MỘT caller trong toàn repo — `auth.ts` (OTP đăng ký). Nghĩa là chủ ví
// KHÔNG BAO GIỜ được báo khi có người mở recovery ví mình.
//
// Vì sao đó là lỗ mất ví chứ không phải lỗi UX: `finalize_recovery` KHÔNG cần
// auth — ai cũng nộp được lên RPC công cộng khi timelock hết. Cửa sổ veto chỉ có
// giá trị nếu chủ ví BIẾT mà bấm veto. Không có đường báo = timelock chạy hết =
// ví đổi chủ, và không ai phải phá một chữ ký nào.
//
// KÊNH NGOÀI APP LÀ BẮT BUỘC. Ví thừa kế có ca sử dụng chính là "nhiều năm không
// mở app" — push cần app còn cài + còn quyền + OS chưa kill, nên với đúng nhóm
// người dùng cần bảo vệ nhất thì push gần như chắc chắn KHÔNG tới. Email là
// đường duy nhất không phụ thuộc thiết bị còn sống.
import { Queue, Worker } from "bullmq";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { publishToUser } from "@/lib/realtime";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { renderNotification } from "@/modules/notifications/domain/render";
import { notifications } from "@/modules/notifications/infra/notifications.schema";

export const NOTIFICATION_DISPATCH_QUEUE = "{notification-dispatch}";

/** Bỏ cuộc sau 5 lần. Row `failed` KHÔNG bị xoá — nó là bằng chứng đã cố gửi. */
const MAX_ATTEMPTS = 5;
/** Trần mỗi tick — giữ tick ngắn, hàng tồn thì tick sau xử tiếp. */
const BATCH = 50;

export const notificationDispatchQueue = new Queue(NOTIFICATION_DISPATCH_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1, // cron PHẢI idempotent, không retry mù — row tự mang attempts
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function scheduleNotificationDispatch(): Promise<void> {
  await notificationDispatchQueue.add(
    "tick",
    {},
    { repeat: { every: 60_000 }, jobId: "notification-dispatch-cron" },
  );
}

export type DispatchResult = { claimed: number; sent: number; failed: number };

/** Lỗi VĨNH VIỄN — thử lại cũng thế (thiếu email, chưa cấu hình push). Đánh
 * `failed` ngay, không đốt 5 lượt retry cho một kết cục đã biết. */
class PermanentDispatchError extends Error {}

// ⚠️ BẪY ĐÃ DÍNH MỘT LẦN: `db.execute()` với sql thô trả về row mang TÊN CỘT DB
// (snake_case), KHÔNG phải tên field camelCase của Drizzle. Nhận thẳng kết quả
// đó thành `Notification` thì `row.userId`/`row.templateKey` là `undefined` một
// cách IM LẶNG — và im lặng theo kiểu tệ nhất: `channel` trùng tên ở cả hai quy
// ước nên nhánh push vẫn "chạy đúng", chỉ email gãy. Map tường minh ở đây.
type RawRow = {
  id: string;
  user_id: string;
  template_key: string;
  params: unknown;
  channel: string;
  attempts: number;
};

type ClaimedRow = {
  id: string;
  userId: string;
  templateKey: string;
  params: unknown;
  channel: string;
  attempts: number;
};

function toClaimed(r: RawRow): ClaimedRow {
  return {
    id: r.id,
    userId: r.user_id,
    templateKey: r.template_key,
    params: r.params,
    channel: r.channel,
    attempts: r.attempts,
  };
}

/**
 * Giành row theo lease, ATOMIC.
 *
 * `FOR UPDATE SKIP LOCKED` + điều kiện `status='queued'`: hai worker chạy song
 * song thì mỗi row chỉ về tay một bên, bên kia bỏ qua chứ không chặn.
 * `attempts` tăng NGAY lúc claim (không phải lúc gửi xong) — process chết giữa
 * lúc gọi provider vẫn tiêu một lượt, nếu không một provider treo sẽ làm row
 * quay vòng vô hạn.
 * Backoff mũ theo `attempts`: 1', 2', 4', 8', 16'.
 */
async function claimBatch(): Promise<ClaimedRow[]> {
  const rows = await db.execute(sql`
    UPDATE ${notifications}
       SET attempts = ${notifications.attempts} + 1,
           claimed_at = now()
     WHERE id IN (
       SELECT id FROM ${notifications}
        WHERE status = 'queued'
          AND attempts < ${MAX_ATTEMPTS}
          AND (claimed_at IS NULL
               OR claimed_at < now() - (interval '1 minute' * power(2, attempts)))
        ORDER BY created_at
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING *
  `);
  return (rows as unknown as RawRow[]).map(toClaimed);
}

/** Email người nhận. Soft-ref sang bảng `user` của Better Auth (id kiểu text). */
async function recipientEmail(userId: string): Promise<string | null> {
  const rows = await db.execute(sql`SELECT email FROM "user" WHERE id = ${userId} LIMIT 1`);
  const first = (rows as unknown as { email?: string }[])[0];
  return first?.email ?? null;
}

async function pushTokens(userId: string): Promise<string[]> {
  const rows = await db.execute(
    sql`SELECT push_token FROM devices WHERE owner_id = ${userId} AND push_token IS NOT NULL`,
  );
  return (rows as unknown as { push_token?: string }[])
    .map((r) => r.push_token)
    .filter((t): t is string => Boolean(t));
}

async function deliver(row: ClaimedRow): Promise<void> {
  // Locale: bảng `user` của Better Auth chưa có cột locale → "en". renderNotification
  // đã tự fallback en và KHÔNG throw khi template/param lệch (thông báo generic
  // còn hơn nuốt mất sự kiện an ninh).
  // `params` là jsonb → `unknown`. Thu hẹp thật (object không-null, không mảng)
  // thay vì cast bừa: một row có params kiểu lạ không được phép làm chết worker
  // và kéo theo mọi thông báo an ninh phía sau nó trong hàng đợi.
  const params =
    typeof row.params === "object" && row.params !== null && !Array.isArray(row.params)
      ? (row.params as Record<string, unknown>)
      : null;
  const { title, body } = renderNotification(row.templateKey, "en", params);

  switch (row.channel) {
    case "email": {
      const to = await recipientEmail(row.userId);
      if (!to) throw new PermanentDispatchError("NO_EMAIL_FOR_USER");
      await sendEmail({ to, subject: title, text: body });
      return;
    }
    case "push": {
      // firebase-admin có trong deps nhưng CHƯA cấu hình. Luật: fail RÕ RÀNG,
      // không im lặng bỏ qua — một kênh cảnh báo tưởng-là-đang-chạy nguy hiểm
      // hơn hẳn một kênh biết rõ là tắt.
      if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new PermanentDispatchError("PUSH_NOT_CONFIGURED");
      }
      const tokens = await pushTokens(row.userId);
      if (tokens.length === 0) throw new PermanentDispatchError("NO_PUSH_TOKEN");
      const { getMessaging } = await import("firebase-admin/messaging");
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      if (getApps().length === 0) {
        initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
      }
      await getMessaging().sendEachForMulticast({ tokens, notification: { title, body } });
      return;
    }
    case "sse": {
      // Kênh TRONG app — bổ sung, không bao giờ thay email cho sự kiện an ninh.
      await publishToUser(row.userId, "notification", { title, body, key: row.templateKey });
      return;
    }
    default:
      throw new PermanentDispatchError(`UNKNOWN_CHANNEL:${row.channel}`);
  }
}

export async function runNotificationDispatchTick(): Promise<DispatchResult> {
  const claimed = await claimBatch();
  let sent = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      await deliver(row);
      await db.execute(
        sql`UPDATE ${notifications} SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = ${row.id}`,
      );
      sent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 256) : "UNKNOWN";
      // Vĩnh viễn → chốt `failed` ngay. Tạm thời → để `queued` cho tick sau,
      // TRỪ KHI đã cạn lượt (attempts đã tăng lúc claim nên so với >=).
      const exhausted = err instanceof PermanentDispatchError || row.attempts + 1 >= MAX_ATTEMPTS;
      await db.execute(
        sql`UPDATE ${notifications}
               SET status = ${exhausted ? "failed" : "queued"}, last_error = ${reason}
             WHERE id = ${row.id}`,
      );
      // Thông báo an ninh KHÔNG gửi được là chuyện phải thấy được, không chỉ đếm.
      logger.error(
        { notificationId: row.id, channel: row.channel, key: row.templateKey, reason, exhausted },
        "notify.dispatch.failed",
      );
      failed += 1;
    }
  }

  if (sent > 0 || failed > 0) logger.info({ sent, failed }, "notify.dispatch.tick");
  return { claimed: claimed.length, sent, failed };
}

export function createNotificationDispatchWorker(): Worker {
  return new Worker(
    NOTIFICATION_DISPATCH_QUEUE,
    async () => {
      await redlock.using(["lock:notification-dispatch"], 60_000, async () => {
        await runNotificationDispatchTick();
      });
    },
    { connection: bullConnection },
  );
}
