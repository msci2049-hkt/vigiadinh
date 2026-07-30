// Tra ví bằng EMAIL cho người mất máy (R4 nhóm C). Nguyên tắc bất di (khuôn
// privacy-preserving của .claude/rules/auth.md — forget-password email lạ vẫn
// 200 success): KHÔNG BAO GIỜ trả địa chỉ ví qua HTTP response, KHÔNG tiết lộ
// email có tồn tại hay không — địa chỉ chỉ đi qua HỘP THƯ của chính chủ.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { notifications } from "../../notifications/infra/notifications.schema";

export type WalletOwnerMatch = { walletId: string; ownerUserId: string; stellarAddress: string };

/** Ví MỚI NHẤT của user mang email này. Soft-ref sang bảng `user` Better Auth
 * (id text — như recipientProfile của notification-dispatch). */
export async function walletByOwnerEmail(email: string): Promise<WalletOwnerMatch | null> {
  const rows = await db.execute(sql`
    SELECT w.id, w.user_id, w.stellar_address
      FROM wallets w
      JOIN "user" u ON u.id = w.user_id
     WHERE lower(u.email) = ${email}
     ORDER BY w.created_at DESC
     LIMIT 1
  `);
  const first = (
    rows as unknown as { id?: string; user_id?: string; stellar_address?: string }[]
  )[0];
  if (!first?.id || !first.user_id || !first.stellar_address) return null;
  return { walletId: first.id, ownerUserId: first.user_id, stellarAddress: first.stellar_address };
}

/** Dấu vết an ninh cho MỌI lần tra — kể cả email không tồn tại: dò hàng loạt
 * phải nhìn thấy được từ nhật ký. Chỉ sha256(email), KHÔNG email thô (PII không
 * vào audit — audit đọc được rộng hơn bảng gốc, như luật key_base64). */
export async function auditWalletLookup(input: {
  walletId: string | null;
  emailHash: string;
}): Promise<void> {
  await db.insert(auditLog).values({
    walletId: input.walletId ?? "unmatched",
    kind: "recovery.wallet_lookup",
    actorType: "system",
    payload: { emailHash: input.emailHash },
  });
}

/** Email chở link /recovery/find-wallet?address=… điền sẵn. Handler gọi KHÔNG
 * await (fire-and-forget): nhánh "có ví" không được tốn thêm thời gian đáp ứng
 * đo được so với nhánh "không có" (C2 — chống rò qua timing). Kênh email đơn
 * thuần — người nhận đang MẤT thiết bị, sse/push không có nghĩa ở đây. */
export async function enqueueWalletLookupEmail(input: {
  ownerUserId: string;
  link: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: input.ownerUserId,
    templateKey: "recovery.wallet_lookup",
    params: { link: input.link },
    channel: "email",
  });
}
