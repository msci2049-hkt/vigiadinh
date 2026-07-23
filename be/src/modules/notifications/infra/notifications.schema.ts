// WHY: Bảng `notifications` — hàng đợi thông báo đa ngôn ngữ.
// template_key + params (jsonb): render theo locale NGƯỜI NHẬN lúc gửi (ICU
// MessageFormat — skill fw-indexer-notify), KHÔNG lưu chuỗi đã dịch.
// user_id: SOFT REF user Better Auth. status/channel: CHECK thay enum.
import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    userId: varchar("user_id", { length: 64 }).notNull(),
    templateKey: varchar("template_key", { length: 64 }).notNull(),
    params: jsonb("params"),
    channel: varchar("channel", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_id_idx").on(t.userId),
    statusIdx: index("notifications_status_idx").on(t.status),
    statusCheck: check(
      "notifications_status_check",
      sql`${t.status} IN ('queued','sent','failed')`,
    ),
    channelCheck: check("notifications_channel_check", sql`${t.channel} IN ('push','email','sse')`),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
