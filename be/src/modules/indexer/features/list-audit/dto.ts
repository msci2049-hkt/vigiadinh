import { z } from "zod";

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
