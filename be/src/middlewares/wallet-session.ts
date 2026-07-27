// Cửa thu hồi phiên VÍ — audit 2026-07-25 §1.2.
//
// Bối cảnh: `wallets.jwt_version` + `verifyWalletJwtCurrent` được thêm ở phiên
// trước và khai là "đã đóng". Đo lại thì cửa verify KHÔNG có route nào gọi —
// `resolveWalletSession`/`verifyWalletJwtCurrent` là code chết. Trong khi đó FE
// LƯU token vào localStorage và gắn `Authorization: Bearer <jwt ví>` vào MỌI
// request (`fe/.../lib/wallet-token.ts`). Better Auth thấy Bearer không phải
// session token của nó thì lặng lẽ rơi về cookie — nên request vẫn 200. Hệ quả:
// `finalize_recovery` tăng `jwt_version` mà KHÔNG thu hồi được gì, và FE vẫn coi
// mình "đang đăng nhập ví" vì nó chỉ tự decode `exp` phía client.
//
// Vì sao đặt Ở ĐÂY chứ không rải từng route: rải thì route thêm sau tự động bỏ
// sót, và đúng cái bỏ sót đó là chỗ token chết vẫn đi lọt. Một middleware trên
// `/api/*` thì route mới KHÔNG có cách nào quên.
//
// Bất biến giữ được: middleware này KHÔNG cấp quyền. Nó chỉ TỪ CHỐI token ví đã
// chết và phơi claims qua `c.var.walletSession`. Danh tính cấp quyền vẫn là
// session Better Auth (`c.var.user`) — JWT ví nói "ví nào", không nói "user nào".
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { resolveWalletSession, walletJwtVersion } from "@/modules/sep45";

/**
 * Đường PHẢI đi lọt kể cả khi cầm token ví đã chết.
 *
 * Không có danh sách này thì có bẫy khoá cứng: token trong localStorage đã bị thu
 * hồi, FE gắn nó vào mọi request → `/api/sep45/challenge` và `/api/sep45/token`
 * cũng 401 → không đăng nhập lại được để lấy token mới. Đúng người dùng vừa mất
 * thiết bị lại là người bị khoá ngoài.
 */
const OPEN_PATHS: ReadonlySet<string> = new Set([
  "/api/sep45/challenge",
  "/api/sep45/token",
  "/api/config/validation",
]);

/** Lấy token từ `Authorization: Bearer <token>` (case-insensitive theo RFC 7235). */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export const walletSession: MiddlewareHandler = async (c, next) => {
  c.set("walletSession", null);

  if (OPEN_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  const token = bearerToken(c.req.header("authorization"));
  if (!token) {
    await next();
    return;
  }

  const result = await resolveWalletSession(env.BETTER_AUTH_SECRET, token, walletJwtVersion);

  if (result.state === "revoked") {
    // 401 chứ không 403: token đã chết, việc đúng của client là đăng nhập ví lại,
    // không phải xin quyền. Mã lỗi tường minh để FE phân biệt với UNAUTHENTICATED
    // và biết phải xoá localStorage rồi chạy lại SEP-45.
    c.var.log.warn({ path: c.req.path }, "wallet-session.revoked");
    throw new HTTPException(401, { message: "WALLET_SESSION_REVOKED" });
  }

  // `none` → không phải token của ta (rất có thể là session token Better Auth gửi
  // qua Bearer). Đi tiếp, cửa Bearer của Better Auth xử lý.
  if (result.state === "valid") c.set("walletSession", result.claims);

  await next();
};
