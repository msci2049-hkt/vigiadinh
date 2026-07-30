import { z } from "zod";
import type { AuditEntryWithIntent } from "../../infra/indexer.repository";

/**
 * `cursor` là con trỏ trang mờ đục (opaque) — base64url của `{at,id}` mà trang
 * trước trả về. Mờ đục có chủ đích: client KHÔNG được tự chế mốc, và định dạng
 * trong đó đổi được mà không phá hợp đồng API.
 */
export const listAuditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuery>;

/**
 * Dòng nhật ký như CLIENT nhìn thấy (B3). Thêm `amount` + `recipient` so với bản
 * trước; giữ nguyên mọi trường cũ để không phá hợp đồng đang chạy.
 */
export type AuditItemView = Omit<AuditEntryWithIntent, "intentAmount" | "intentRecipient"> & {
  /** Chuỗi stroops, KHÔNG phải BigInt — xem lý do ở auditItemView. */
  amount: string | null;
  /** Địa chỉ ĐẦY ĐỦ người nhận. Đây là dữ liệu của CHÍNH chủ ví (họ tự gõ vào lúc
   * gửi), không phải của người khác — khác view phía guardian ở
   * intents/domain/format.ts, nơi địa chỉ CỐ Ý bị cắt. Rút gọn để hiển thị là việc
   * của FE. */
  recipient: string | null;
};

/**
 * Đổi `intentAmount` (bigint stroops của Drizzle) thành CHUỖI.
 *
 * Không phải chuyện thẩm mỹ: `c.json()` gọi JSON.stringify, và JSON.stringify
 * THROW trên BigInt — trả thẳng bigint ra là lặp lại đúng lớp lỗi vừa làm indexer
 * chết cứng 48 phút (2026-07-30, xem indexer/domain/json-safe.ts). Chuỗi stroops
 * cũng là quy ước tiền sẵn có của FE (`ScaledAmount`, packages/core/src/money).
 */
export function auditItemView(row: AuditEntryWithIntent): AuditItemView {
  const { intentAmount, intentRecipient, ...entry } = row;
  return {
    ...entry,
    amount: intentAmount === null ? null : intentAmount.toString(),
    recipient: intentRecipient,
  };
}

export type DecodedCursor = { at: Date; id: string };

export function encodeCursor(cursor: DecodedCursor): string {
  return Buffer.from(JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id })).toString(
    "base64url",
  );
}

/**
 * `null` = con trỏ hỏng. Caller phải trả 400 chứ KHÔNG âm thầm coi như "trang
 * đầu": con trỏ rác mà lặng lẽ trả trang 1 thì client lật trang vô hạn không bao
 * giờ hết, và không ai biết tại sao.
 */
export function decodeCursor(raw: string): DecodedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      at?: unknown;
      id?: unknown;
    };
    if (typeof parsed.at !== "string" || typeof parsed.id !== "string") return null;
    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) return null;
    // `id` là ULID 26 ký tự — chặn chuỗi lạ trước khi nó thành tham số truy vấn.
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(parsed.id)) return null;
    return { at, id: parsed.id };
  } catch {
    return null;
  }
}
