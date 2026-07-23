---
globs: src/modules/webhook/**,src/services/webhooks/**,src/middlewares/raw-body.ts
description: Webhook receiver patterns. HMAC verify, raw body, dedup, replay guard.
---

# Rule: Webhook receiver

Áp dụng cho code nhận webhook từ provider (Stripe, GitHub, SePay).

## 3 lớp bảo vệ — BẮT BUỘC đủ

1. **HMAC verify** với `crypto.timingSafeEqual`
2. **Timestamp tolerance** (5 phút) — chống replay
3. **UNIQUE (provider, external_id)** index — chống duplicate

Thiếu 1 → webhook không an toàn.

## Raw body MUST capture TRƯỚC json parser

```ts
// src/middlewares/raw-body.ts
export const captureRawBody: MiddlewareHandler = async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    c.set("rawBody", await c.req.raw.clone().text());
  }
  await next();
};
```

`c.req.raw.clone().text()` cần thiết: stream chỉ đọc 1 lần, JSON.parse + stringify lại thay đổi whitespace/key order → HMAC fail.

## HMAC compare — KHÔNG dùng `===`

```ts
// ✅
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ❌ — timing attack: so từng byte mất thời gian khác nhau
if (expected === received) { /* ... */ }
```

## Stripe verify

```ts
// Header: stripe-signature: t=<ts>,v1=<sig>
// Signed payload: `${ts}.${rawBody}` HMAC-SHA256

const STRIPE_TOLERANCE_SEC = 300; // 5 phút

const age = Math.floor(Date.now() / 1000) - Number(ts);
if (Math.abs(age) > STRIPE_TOLERANCE_SEC) return { ok: false, reason: "TIMESTAMP_EXPIRED" };
```

## Handler flow CHUẨN

```ts
.post("/stripe", async (c) => {
  // 1. Verify
  const raw = c.get("rawBody");
  const v = verifyStripe(raw, c.req.header("stripe-signature") ?? "");
  if (!v.ok) throw new HTTPException(400, { message: `INVALID_SIGNATURE:${v.reason}` });

  // 2. Parse + persist (dedup qua UNIQUE index)
  const event = JSON.parse(raw);
  try {
    const [row] = await db.insert(webhookEvents).values({
      provider: "stripe",
      externalId: event.id,
      eventType: event.type,
      payload: event,
      status: "received",
    }).returning({ id: webhookEvents.id });

    // 3. Enqueue worker (xử lý nặng sau, ack ngay)
    await enqueueProcessWebhookEvent({ eventId: row.id, ... });
    return c.json({ success: true, id: row.id });
  } catch (err) {
    // PG 23505 = unique_violation → đã xử lý
    if ((err as { code?: string }).code === "23505") {
      return c.json({ success: true, deduplicated: true });
    }
    throw err;
  }
});
```

## Ack < 1 giây

Provider timeout 5-30s, retry storm nếu chậm. Quy tắc:
- Verify + INSERT + enqueue = sync
- Xử lý nghiệp vụ = worker (BullMQ)
- Return 200 NGAY sau enqueue

Đo bằng `time curl` — phải < 1s.

## Cấm

- ❌ Xử lý nghiệp vụ sync trong handler (`createOrder`, `chargeUser`...) → đẩy worker.
- ❌ Return 200 trước khi INSERT vào `webhook_events` → mất audit trail.
- ❌ Catch error chung rồi trả 500 → provider retry vô tận.
- ❌ Bảng `webhook_events` không có UNIQUE `(provider, external_id)` → duplicate xử lý 2 lần.

## Khi sửa file ở đây, MUST verify

- [ ] `captureRawBody` middleware mount TRƯỚC handler.
- [ ] HMAC dùng `crypto.timingSafeEqual`.
- [ ] Stripe có timestamp tolerance 5 phút.
- [ ] Bảng có UNIQUE (provider, external_id).
- [ ] Catch PG 23505 → trả deduplicated.
- [ ] Worker xử lý qua BullMQ, không sync.
- [ ] `time curl` < 1s.
