// JWT HS256 tự chứa cho phiên VÍ (SEP-45) — tách khỏi session Better Auth (session
// user là "ai đăng nhập app"; JWT ví là "ví nào + thiết bị nào đã chứng minh sở hữu
// on-chain"). Ký bằng BETTER_AUTH_SECRET, không thêm dependency.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { WalletJwtClaims } from "./types";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export function signWalletJwt(secret: string, claims: WalletJwtClaims): string {
  const body = `${HEADER}.${b64url(JSON.stringify(claims))}`;
  return `${body}.${hmac(secret, body).toString("base64url")}`;
}

/**
 * Kiểm CHỮ KÝ + HẠN, KHÔNG kiểm thu hồi. `internal` vì dùng một mình là thiếu:
 * xem [`verifyWalletJwtCurrent`].
 *
 * Để `export` (không `private`) chỉ vì test đơn vị soi riêng phần crypto; mọi
 * đường dùng thật phải đi qua bản có kiểm số hiệu phiên.
 */
export function verifyWalletJwtSignatureOnly(
  secret: string,
  token: string,
): WalletJwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  if (header !== HEADER) return null;
  const expected = hmac(secret, `${header}.${payload}`);
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let claims: WalletJwtClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}

/** Tra số hiệu phiên hiện tại của ví (`sub`). `null` = không biết ví này. */
export type WalletVersionLookup = (walletAddress: string) => Promise<number | null>;

/**
 * Cửa DUY NHẤT được phép dùng để nhận một JWT ví (closeout §4).
 *
 * Ngoài chữ ký + hạn, nó đòi `ver` trong claims khớp `jwt_version` hiện tại trong
 * DB. Vì sao cần: JWT HS256 là token TỰ CHỨNG — sau khi phát, không có gì tra để
 * chối nó cho tới lúc `exp`. Recovery xoay khoá thì thiết bị cũ mất quyền KÝ ngay
 * (on-chain cưỡng chế), nhưng vẫn ĐỌC được bằng JWT cũ tới hết TTL. Custody chặn
 * mất tiền; nó không chặn đọc dữ liệu phiên của gia đình.
 *
 * Vì sao API bắt buộc truyền `lookup` thay vì có bản "tiện" không kiểm: cửa này
 * hiện CHƯA có route nào gọi (JWT ví được phát ở /api/sep45/token nhưng chưa
 * middleware nào tiêu thụ). Nếu để sẵn một hàm verify không kiểm thu hồi thì người
 * nối dây sau sẽ gọi đúng cái đó — và lỗ mở ra đúng lúc token bắt đầu có giá trị.
 * Bắt buộc từ trong chữ ký hàm là cách duy nhất chắc chắn.
 *
 * Fail-closed: ví không tra được (`null`) hoặc `ver` thiếu/lệch đều trả `null`.
 * Token phát TRƯỚC khi có cột này không có `ver` → bị chối, đúng ý: chúng thuộc
 * thời kỳ không thu hồi được.
 */
export async function verifyWalletJwtCurrent(
  secret: string,
  token: string,
  lookup: WalletVersionLookup,
): Promise<WalletJwtClaims | null> {
  const claims = verifyWalletJwtSignatureOnly(secret, token);
  if (claims === null) return null;
  if (typeof claims.ver !== "number") return null;
  const current = await lookup(claims.sub);
  if (current === null || current !== claims.ver) return null;
  return claims;
}

/**
 * Kết quả phân loại một Bearer token bất kỳ (audit 2026-07-25 §1.2).
 *
 * - `none`   — không phải JWT ví của ta (Better Auth session token, rác, rỗng).
 *              Middleware PHẢI đi tiếp: cửa Bearer của Better Auth sở hữu nó.
 * - `revoked`— ĐÚNG là JWT ví ta phát, chữ ký thật, còn hạn, NHƯNG `ver` lệch
 *              `jwt_version` hiện tại (hoặc thiếu `ver`, hoặc ví biến mất).
 *              Middleware PHẢI trả 401 — im lặng bỏ qua là biến "đã thu hồi"
 *              thành "vẫn dùng được ở mọi nơi khác".
 * - `valid`  — dùng được, kèm claims.
 */
export type WalletSessionState =
  | { state: "none" }
  | { state: "revoked" }
  | { state: "valid"; claims: WalletJwtClaims };

/**
 * Vì sao phải là MỘT hàm chứ không phải "gọi verifySignatureOnly rồi verifyCurrent"
 * ở tầng middleware: phân biệt `none` với `revoked` bắt buộc phải xem chữ ký
 * TRƯỚC khi tra DB, mà bản chỉ-kiểm-chữ-ký cố ý không rời khỏi module này (xem
 * chú thích của nó). Đưa việc phân loại vào đây giữ được cả hai: middleware có đủ
 * thông tin để 401 đúng token, và không ai ngoài module cầm được cửa thiếu kiểm.
 */
export async function resolveWalletSession(
  secret: string,
  token: string,
  lookup: WalletVersionLookup,
): Promise<WalletSessionState> {
  const shallow = verifyWalletJwtSignatureOnly(secret, token);
  if (shallow === null) return { state: "none" };
  const claims = await verifyWalletJwtCurrent(secret, token, lookup);
  if (claims === null) return { state: "revoked" };
  return { state: "valid", claims };
}
