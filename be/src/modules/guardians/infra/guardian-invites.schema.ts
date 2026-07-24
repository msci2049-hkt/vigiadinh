// WHY: Bảng `guardian_invites` — lời mời làm người bảo hộ (wizard mức B).
//
// Vì sao là bảng RIÊNG chứ không thêm cột vào `guardians`: lời mời có vòng đời
// riêng (hết hạn, bị thu hồi, gửi lại) và có thể KHÔNG BAO GIỜ thành guardian.
// Trộn vào `guardians` là bắt bảng đó chứa cả người chưa nhận lời — rồi mọi
// query "ai đang bảo hộ ví này" phải nhớ lọc, và một ngày ai đó quên.
//
// Trạng thái là một chiều, không quay lui:
//   sent      → mới tạo, chưa ai bấm
//   accepted  → người được mời đã mở link, đã có tài khoản
//   deployed  → họ đã tạo passkey + deploy ví hợp đồng của CHÍNH HỌ (có C…)
//   registered→ chủ ví đã ký `add_guardian` on-chain — LÚC NÀY mới tính là bảo hộ
//   expired   → quá hạn / bị thu hồi
//
// BẤT BIẾN: cột khoá chỉ chứa ĐỊA CHỈ CÔNG KHAI (C…). Server không bao giờ sinh
// khoá hộ người bảo hộ và không bao giờ nhận private key — xem docs/THREAT-MODEL.
import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const guardianInvites = pgTable(
  "guardian_invites",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    /** Token trong link mời — ngẫu nhiên, KHÔNG đoán được, tra bằng unique index. */
    token: varchar("token", { length: 64 }).notNull(),
    /** Tên gọi thân mật do chủ ví đặt ("Mẹ", "Anh Hai") — hiện lại cho chủ ví. */
    label: varchar("label", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("sent"),
    /** User nhận lời (soft ref — Better Auth id là text). */
    acceptedByUserId: varchar("accepted_by_user_id", { length: 64 }),
    /** Địa chỉ ví hợp đồng của người bảo hộ — CHỈ public, không bao giờ là khoá bí mật. */
    guardianAddress: varchar("guardian_address", { length: 56 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUq: uniqueIndex("guardian_invites_token_uq").on(t.token),
    walletIdx: index("guardian_invites_wallet_idx").on(t.walletId),
    statusCheck: check(
      "guardian_invites_status_check",
      sql`${t.status} IN ('sent','accepted','deployed','registered','expired')`,
    ),
  }),
);

export type GuardianInvite = typeof guardianInvites.$inferSelect;
export type NewGuardianInvite = typeof guardianInvites.$inferInsert;
