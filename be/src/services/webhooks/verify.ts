// WHY: HMAC verify cho 3 provider (Stripe/GitHub/SePay). Quy tắc:
//  - timingSafeEqual (KHÔNG `===`): so từng byte mất thời gian khác nhau →
//    attacker đo timing có thể guess được signature.
//  - Stripe tolerance 5 phút: chống replay — chữ ký cũ không gửi lại được sau
//    window này dù secret đúng.
//  - Env secret OPTIONAL ở env.ts (provider không dùng thì khỏi set). Khi
//    handler gọi verifyX() mà env chưa set → THROW rõ ràng — không silent
//    `return false` (false = "sig sai", che dấu lỗi config).
//
// Theo .claude/rules/webhook.md.
import crypto from "node:crypto";
import { env } from "@/env";

// `timingSafeEqual` throw nếu 2 buffer khác length — early-return false để an
// toàn (length khác = chắc chắn không match).
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// === Stripe ===
// Header: stripe-signature: t=<unix>,v1=<hex>[,v1=<old-hex>] (legacy rotation)
// Signed payload: `${ts}.${rawBody}` HMAC-SHA256 với STRIPE_WEBHOOK_SECRET.
const STRIPE_TOLERANCE_SEC = 300;

export function verifyStripe(
  rawBody: string,
  sigHeader: string,
): { ok: boolean; reason?: "BAD_HEADER" | "TIMESTAMP_EXPIRED" } {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  // Parse "k=v,k=v" — first-wins (Stripe có thể có 2 v1 khi rotate secret,
  // v1 đầu là secret hiện hành). split("=") sẽ cắt mất signature có "="
  // → dùng indexOf để chỉ cắt dấu "=" đầu tiên.
  const parts: Record<string, string> = {};
  for (const p of sigHeader.split(",")) {
    const eq = p.indexOf("=");
    if (eq < 1) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (!(k in parts)) parts[k] = v;
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return { ok: false, reason: "BAD_HEADER" };

  // Number("abc") = NaN → Math.abs(NaN) = NaN → NaN > 300 = false → BYPASS
  // tolerance check. Phải check finite TRƯỚC.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "BAD_HEADER" };
  const age = Math.floor(Date.now() / 1000) - tsNum;
  if (Math.abs(age) > STRIPE_TOLERANCE_SEC) return { ok: false, reason: "TIMESTAMP_EXPIRED" };

  const expected = crypto
    .createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  return { ok: safeEqual(expected, sig) };
}

// === GitHub ===
// Header: x-hub-signature-256: sha256=<hex>
// HMAC-SHA256 rawBody với GITHUB_WEBHOOK_SECRET.
export function verifyGithub(rawBody: string, sigHeader: string): boolean {
  if (!env.GITHUB_WEBHOOK_SECRET) {
    throw new Error("GITHUB_WEBHOOK_SECRET not configured");
  }
  if (!sigHeader.startsWith("sha256=")) return false;
  const sig = sigHeader.slice("sha256=".length);
  const expected = crypto
    .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, sig);
}

// === SePay ===
// Header: Authorization: Apikey <SEPAY_API_KEY>
// Compare API key bằng timingSafeEqual (vẫn timing attack được dù không HMAC).
export function verifySePayApiKey(authHeader: string | undefined): boolean {
  if (!env.SEPAY_API_KEY) {
    throw new Error("SEPAY_API_KEY not configured");
  }
  if (!authHeader?.startsWith("Apikey ")) return false;
  return safeEqual(authHeader.slice("Apikey ".length), env.SEPAY_API_KEY);
}
