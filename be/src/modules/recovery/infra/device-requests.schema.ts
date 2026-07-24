// Bảng `recovery_device_requests` — "tiếng gõ cửa" từ THIẾT BỊ MỚI của người
// mất máy (PHA 6 cụm GHI, sau audit P0): máy mới tự tạo passkey rồi gửi vật
// liệu khoá (verifier + public key) lên đây. Đây KHÔNG phải yêu cầu khôi phục
// on-chain — chỉ là lời nhắn cho guardian; guardian xác minh NGOÀI BĂNG (gọi
// điện) rồi tự initiate on-chain với ĐÚNG vật liệu này. Server không sinh,
// không giữ, không ký gì bằng khoá (bất biến 2).
import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { wallets } from "../../wallets/infra/wallets.schema";

export const recoveryDeviceRequests = pgTable(
  "recovery_device_requests",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    walletId: varchar("wallet_id", { length: 26 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    // Vật liệu Signer::External — verifier contract + public key (base64).
    verifier: varchar("verifier", { length: 56 }).notNull(),
    keyBase64: varchar("key_base64", { length: 160 }).notNull(),
    // sha256 hex của Signer ScVal — TRÙNG công thức fingerprint của contract
    // (guardian đối chiếu mã này qua kênh ngoài trước khi initiate).
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("recovery_device_requests_wallet_id_idx").on(t.walletId),
    statusCheck: check(
      "recovery_device_requests_status_check",
      sql`${t.status} IN ('open','withdrawn','superseded')`,
    ),
  }),
);

export type RecoveryDeviceRequest = typeof recoveryDeviceRequests.$inferSelect;
export type NewRecoveryDeviceRequest = typeof recoveryDeviceRequests.$inferInsert;
