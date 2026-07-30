import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
// Schema của module khác cho MỘT câu JOIN — cùng khuôn indexer.service.ts đã dùng
// với `wallets` + `recovery_requests`. Không gọi service/feature của intents.
import { transactionIntents } from "../../intents/infra/intents.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type AuditEntry, auditLog, type NewAuditEntry } from "./audit-log.schema";

const LIST_LIMIT = 100;

/** Con trỏ trang: mốc sắp xếp (`at`) + `id` để phá hoà (nhiều dòng cùng mili giây). */
export type AuditCursor = { at: Date; id: string };

/**
 * Dòng nhật ký + số tiền/người nhận của lệnh gửi gắn với nó (B3).
 *
 * `audit_log.payload` chỉ chở `hash` + `status` + `intentId` — số tiền và người
 * nhận nằm ở `transaction_intents`. Trước bản này API không join, nên lịch sử đọc
 * được nhưng thiếu đúng hai thứ người dùng cần: "bao nhiêu?" và "cho ai?".
 *
 * Cả hai NULLABLE: phần lớn dòng (register, guardian, hạn mức) không dính lệnh gửi.
 */
export type AuditEntryWithIntent = AuditEntry & {
  /** stroops. bigint ở đây — tầng view PHẢI đổi sang string trước khi ra JSON. */
  intentAmount: bigint | null;
  intentRecipient: string | null;
};

export type AuditPage = {
  items: AuditEntryWithIntent[];
  /** null = hết dữ liệu. Khác null thì client gửi lại ở `?cursor=` để lấy trang sau. */
  nextCursor: AuditCursor | null;
};

/**
 * Audit 2026-07-25 (§6.5) — phân trang bằng CON TRỎ, không offset.
 *
 * Bản cũ `LIMIT 100` không con trỏ: ví dùng vài tháng thì mọi thứ cũ hơn 100 dòng
 * gần nhất **không còn cách nào đọc được**. Với nhật ký append-only của một cái ví,
 * đó là lỗi CHỨC NĂNG, không phải chuyện hiệu năng — "xem lại giao dịch tháng
 * trước" là lý do tồn tại của cái bảng này.
 *
 * Con trỏ chứ không OFFSET: bảng chỉ ghi thêm, `OFFSET n` sẽ nhảy cóc/lặp dòng khi
 * có bản ghi mới chèn vào giữa lúc người dùng lật trang. So sánh theo bộ đôi
 * `(at, id)` giữ thứ tự tổng, kể cả khi nhiều sự kiện trùng mốc thời gian.
 */
export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  limit = LIST_LIMIT,
  cursor?: AuditCursor,
): Promise<AuditPage> {
  const scope = and(eq(auditLog.walletId, walletId), eq(wallets.userId, ownerUserId));
  // Sắp giảm dần → trang sau là những dòng "nhỏ hơn" con trỏ theo (at, id).
  const paged = cursor
    ? and(
        scope,
        or(lt(auditLog.at, cursor.at), and(eq(auditLog.at, cursor.at), lt(auditLog.id, cursor.id))),
      )
    : scope;

  // Lấy DƯ 1 dòng để biết còn trang sau hay không, không cần COUNT(*) riêng.
  //
  // LEFT JOIN, KHÔNG inner: dòng không có lệnh gửi (register, guardian.approved,
  // policy.change_applied…) vẫn phải trả về — inner join là xoá sạch phần lớn
  // nhật ký. Nối qua `payload->>'intentId'` nên không cần thêm cột (B3 không có
  // migration); `->>` trên jsonb mảng/scalar/NULL trả NULL chứ không lỗi, nên
  // payload dị dạng không làm sập cả endpoint.
  //
  // 🔴 HÀNG RÀO CHÉO VÍ: điều kiện `transaction_intents.wallet_id =
  // audit_log.wallet_id` là BẮT BUỘC, không phải tối ưu. `transaction_intents.id`
  // là ULID duy nhất toàn cục, nên một `intentId` trong payload chỉ khớp đúng MỘT
  // dòng — nếu dòng đó thuộc ví khác thì phải ra NULL (mất chi tiết), TUYỆT ĐỐI
  // không được chở số tiền + địa chỉ người nhận của ví người khác sang đây.
  const rows = await db
    .select({
      entry: auditLog,
      intentAmount: transactionIntents.amount,
      intentRecipient: transactionIntents.recipient,
    })
    .from(auditLog)
    .innerJoin(wallets, eq(auditLog.walletId, wallets.id))
    .leftJoin(
      transactionIntents,
      and(
        eq(transactionIntents.walletId, auditLog.walletId),
        sql`${auditLog.payload}->>'intentId' = ${transactionIntents.id}`,
      ),
    )
    .where(paged)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map((r) => ({
    ...r.entry,
    intentAmount: r.intentAmount,
    intentRecipient: r.intentRecipient,
  }));
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? { at: last.at, id: last.id } : null;
  return { items, nextCursor };
}

export async function append(data: NewAuditEntry): Promise<AuditEntry> {
  const [row] = await db.insert(auditLog).values(data).returning();
  if (!row) throw new Error("AUDIT_APPEND_FAILED");
  return row;
}
