// WHY: Bảng `presence_pings` — mỗi lần ping 12:00 gửi tới máy guardian + ack.
// FK cứng: guardian (cascade — ping vô nghĩa khi guardian xóa),
// device (set null — giữ lịch sử ping khi máy bị gỡ).
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { guardians } from "../../guardians/infra/guardians.schema";
import { devices } from "./devices.schema";

export const presencePings = pgTable(
  "presence_pings",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    guardianId: varchar("guardian_id", { length: 26 })
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 26 }).references(() => devices.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    ackedAt: timestamp("acked_at", { withTimezone: true }),
  },
  (t) => ({
    guardianIdx: index("presence_pings_guardian_id_idx").on(t.guardianId),
    deviceIdx: index("presence_pings_device_id_idx").on(t.deviceId),
    sentIdx: index("presence_pings_sent_at_idx").on(t.sentAt),
  }),
);

export type PresencePing = typeof presencePings.$inferSelect;
export type NewPresencePing = typeof presencePings.$inferInsert;
