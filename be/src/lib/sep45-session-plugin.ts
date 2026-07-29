// Plugin Better Auth: ĐỔI JWT ví (SEP-45) lấy SESSION APP — "vân tay là chìa khoá thật".
//
// Vì sao tồn tại (lô 29/07 tối): trước đây ký passkey chỉ phát JWT ví (để ký giao
// dịch), còn cổng `_authenticated` đòi session Better Auth — thứ chỉ email/OTP cấp
// được. Hệ quả: sản phẩm hứa "không phải nhớ gì" nhưng chìa khoá thật lại là email,
// và kịch bản khôi phục (mất máy → guardian duyệt → passkey mới) vẫn chết ở cổng
// email. Cửa này đóng đúng khoảng trống đó: passkey đã CHỨNG MINH sở hữu ví qua
// SEP-45 thì được cấp session của chủ ví — không cần email.
//
// VÌ SAO TIN ĐƯỢC JWT VÍ (mọi quyết định nới quyền phải trả lời câu này):
// /api/sep45/token chỉ phát sau khi (service.ts:74-117):
//   1. chữ ký passkey verify bằng SIMULATE __check_auth của CHÍNH contract ví;
//   2. nonce single-use (GETDEL) — chống replay challenge;
//   3. footprint chỉ-nonce — entry lạ (vd transfer trá hình) bị chối;
//   4. ví phải có trong DB (`ver` = jwt_version, thu hồi được khi recovery xoay khoá).
// Đó là bằng chứng sở hữu VÍ mạnh hơn email+mật khẩu chứng minh sở hữu TÀI KHOẢN.
//
// BA HÀNG RÀO của riêng cửa đổi (JWT ví nằm ở localStorage — XSS đọc được, nên cửa
// đổi không được biến một token bị trộm thành session dài hạn):
//   1. TƯƠI: token phát quá MAX_TOKEN_AGE_SECONDS không đổi được nữa — FE đổi NGAY
//      sau khi ký, token cũ nằm kho chỉ còn dùng được cho API ví như trước.
//   2. MỘT LẦN: mỗi jti đổi được đúng một lần (SETNX) — token đã đổi mà bị trộm
//      sau đó là vô giá trị ở cửa này.
//   3. THU HỒI: đi qua resolveWalletSession (kiểm ver) — recovery xoay khoá xong
//      là token cũ chết ở đây y như ở middleware.
//
// SESSION CẤP RA GẮN VỚI ĐÚNG VÍ VỪA KÝ (activeWalletId): tài khoản có 2 ví thì
// passkey ví A không được thành giấy thông hành hành động trên ví B — các cửa GHI
// theo ví kiểm scope này (lib/wallet-scope.ts).
//
// Mã lỗi trả 403/409 chứ KHÔNG 401: apiClient của FE đá mọi 401 sang /login —
// đúng cho API thường, sai cho chính cửa đăng nhập (người dùng đang đứng ở màn
// passkey, cần đọc được lý do tại chỗ).
import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { rateLimitConnection } from "@/lib/redis";
import { resolveWalletSession, walletIdentityByAddress, walletJwtVersion } from "@/modules/sep45";

/** Token phát quá 5 phút không đổi được nữa — FE đổi ngay sau khi ký (cùng tick). */
export const MAX_TOKEN_AGE_SECONDS = 300;

/**
 * Che email khi báo "khoá này thuộc tài khoản khác" (B3): người cầm passkey của ví
 * đó đáng được biết MÌNH đang cầm nhầm chìa của ai ở mức nhận ra được, nhưng cửa
 * này không được thành máy tra email theo passkey.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const keep = Math.min(3, Math.max(1, local.length - 1));
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

/**
 * Endpoint: POST /api/auth/sep45/exchange  body {token}
 *
 * Nằm DƯỚI Better Auth (plugin) chứ không phải route Hono thường vì session là
 * của Better Auth: cookie ký + cookieCache + bearer set-auth-token (WebView PHA
 * 8-9) đều do nó lo — tự chế cookie ở ngoài là tự nhận việc đồng bộ bốn cơ chế đó
 * bằng tay, và lệch một cái là phiên "nửa sống".
 */
export function sep45SessionPlugin() {
  return {
    id: "sep45-session",
    endpoints: {
      sep45Exchange: createAuthEndpoint(
        "/sep45/exchange",
        { method: "POST", body: z.object({ token: z.string().min(1).max(4096) }) },
        async (ctx) => {
          // 1) JWT ví phải THẬT + CÒN SỐNG — đi qua đúng một cửa verify có kiểm
          // thu hồi của module sep45 (không có bản "tiện" bỏ kiểm ver).
          const resolved = await resolveWalletSession(
            env.BETTER_AUTH_SECRET,
            ctx.body.token,
            walletJwtVersion,
          );
          if (resolved.state === "revoked") {
            throw new APIError("FORBIDDEN", { message: "WALLET_SESSION_REVOKED" });
          }
          if (resolved.state !== "valid") {
            throw new APIError("FORBIDDEN", { message: "WALLET_TOKEN_INVALID" });
          }
          const claims = resolved.claims;

          // 2) TƯƠI — token để lâu (trộm từ localStorage rồi dùng sau) bị chối.
          const now = Math.floor(Date.now() / 1000);
          if (typeof claims.iat !== "number" || now - claims.iat > MAX_TOKEN_AGE_SECONDS) {
            throw new APIError("FORBIDDEN", { message: "WALLET_TOKEN_STALE" });
          }

          // 3) MỘT LẦN — jti (sha256 nonce, duy nhất theo challenge) chỉ đổi được
          // một lần. NX đặt TRƯỚC khi cấp: thua race là chối, không bao giờ phát
          // hai session cho một lần ký. Cùng store fail-fast với nonce SEP-45.
          const ttl = Math.max(claims.exp - now, 60);
          const fresh = await rateLimitConnection.set(
            `sep45:exchange:${claims.jti}`,
            "1",
            "EX",
            ttl,
            "NX",
          );
          if (fresh !== "OK") {
            throw new APIError("FORBIDDEN", { message: "WALLET_TOKEN_USED" });
          }

          // 4) Ví → chủ ví. Không có dòng ví = không biết cấp cho ai → chối,
          // KHÔNG tự tạo user: dòng ví do luồng có phiên tạo (mirror lúc tạo ví);
          // tự tạo user theo passkey lạ là cho phép bất kỳ ai deploy contract rồi
          // đúc tài khoản mồ côi trong DB.
          const identity = await walletIdentityByAddress(claims.sub);
          if (!identity) throw new APIError("FORBIDDEN", { message: "WALLET_UNKNOWN" });
          const user = await ctx.context.internalAdapter.findUserById(identity.userId);
          if (!user) throw new APIError("FORBIDDEN", { message: "WALLET_UNKNOWN" });

          // 5) Đang đăng nhập TÀI KHOẢN KHÁC mà ký passkey của ví người khác →
          // chặn + nói rõ (che email). Đổi người là hành động chủ động: đăng
          // xuất trước rồi ký lại — không lặng lẽ tráo phiên dưới chân người dùng.
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (current && current.user.id !== identity.userId) {
            throw new APIError("CONFLICT", {
              message: `WALLET_BELONGS_TO_OTHER_ACCOUNT:${maskEmail(user.email)}`,
            });
          }

          // 6) Cấp session GẮN VÍ. Cùng user ký ví khác của họ (đổi khoá B1) thì
          // session mới thay session cũ — scope đi theo ví vừa ký.
          const session = await ctx.context.internalAdapter.createSession(user.id, undefined, {
            activeWalletId: identity.walletId,
          });
          if (!session) {
            logger.error({ wallet: identity.walletId }, "sep45.exchange.session-failed");
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "SESSION_CREATE_FAILED" });
          }
          await setSessionCookie(ctx, { session, user });
          logger.info(
            { userId: user.id, walletId: identity.walletId, device: claims.device ?? null },
            "sep45.exchange.session-created",
          );
          return ctx.json({ user: { id: user.id }, wallet_id: identity.walletId });
        },
      ),
    },
  } as const;
}
