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

/** Trả claims nếu token hợp lệ + chưa hết hạn; ngược lại null (route map 401). */
export function verifyWalletJwt(secret: string, token: string): WalletJwtClaims | null {
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
