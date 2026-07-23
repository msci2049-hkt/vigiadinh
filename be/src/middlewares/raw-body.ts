// WHY: HMAC webhook verify cần body NGUYÊN BẢN (byte-for-byte). Sau khi
// `c.req.json()` parse rồi `JSON.stringify` lại → whitespace/key order thay
// đổi → HMAC fail. `c.req.raw.clone().text()` đọc 1 lần snapshot vào
// `c.var.rawBody`; downstream handler vẫn dùng được `c.req.json()` (Hono
// cache body internally).
//
// Theo .claude/rules/webhook.md.
import type { MiddlewareHandler } from "hono";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

export const captureRawBody: MiddlewareHandler = async (c, next) => {
  if (METHODS_WITH_BODY.has(c.req.method)) {
    // .clone() để giữ stream gốc cho c.req.json()/text() ở handler.
    c.set("rawBody", await c.req.raw.clone().text());
  }
  await next();
};
