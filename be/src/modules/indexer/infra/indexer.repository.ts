import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type AuditEntry, auditLog, type NewAuditEntry } from "./audit-log.schema";

const LIST_LIMIT = 100;

/** Con trỏ trang: mốc sắp xếp (`at`) + `id` để phá hoà (nhiều dòng cùng mili giây). */
export type AuditCursor = { at: Date; id: string };

export type AuditPage = {
  items: AuditEntry[];
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
  const rows = await db
    .select({ entry: auditLog })
    .from(auditLog)
    .innerJoin(wallets, eq(auditLog.walletId, wallets.id))
    .where(paged)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map((r) => r.entry);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? { at: last.at, id: last.id } : null;
  return { items, nextCursor };
}

export async function append(data: NewAuditEntry): Promise<AuditEntry> {
  const [row] = await db.insert(auditLog).values(data).returning();
  if (!row) throw new Error("AUDIT_APPEND_FAILED");
  return row;
}
