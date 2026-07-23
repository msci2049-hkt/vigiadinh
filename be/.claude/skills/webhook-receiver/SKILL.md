# SKILL: Nhận webhook (Stripe / SePay / GitHub)

## Dùng khi nào

- Provider gửi POST callback: thanh toán, sự kiện, signed event.
- Cần verify chữ ký, chống replay, chống duplicate.
- Cần ack < 1s (provider timeout 5-30s) → xử lý nặng đẩy queue.

---

## Thứ tự làm

```
1. Bảng webhook_events trong src/db/schema/webhook-events.ts
   → UNIQUE(provider, external_id) cho idempotency.

2. src/middlewares/raw-body.ts — capture raw body TRƯỚC json parser.

3. src/services/webhooks/verify.ts — verifier per provider:
   - Stripe: HMAC + timestamp tolerance
   - GitHub: HMAC sha256
   - SePay: API-Key header (hoặc HMAC variant)

4. src/modules/webhook/routes.ts — handler PER provider:
   verify → INSERT (catch 23505) → enqueue → return 200.

5. Curl test 4 case: valid / wrong-sig / replay / duplicate.
```

---

## File tạo ở đâu

```
src/db/schema/webhook-events.ts             ← bảng dedup
src/middlewares/raw-body.ts                 ← capture raw body
src/services/webhooks/verify.ts             ← per-provider HMAC verify
src/modules/webhook/routes.ts               ← endpoints
src/jobs/process-webhook-event/             ← worker (skill new-job)
```

---

## Code mẫu

### 1. `src/db/schema/webhook-events.ts`

```ts
import { pgTable, varchar, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull(), // received|processed|failed
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupUq: uniqueIndex("webhook_events_provider_extid_uq").on(t.provider, t.externalId),
  }),
);
```

### 2. `src/middlewares/raw-body.ts`

```ts
/**
 * Capture raw body TRƯỚC khi parse JSON.
 *
 * HMAC verify yêu cầu byte EXACT provider gửi. JSON.parse + JSON.stringify
 * thay đổi whitespace/key order → chữ ký fail.
 *
 * c.req.raw.clone() cần thiết: stream chỉ đọc 1 lần,
 * downstream handler vẫn cần nguyên bản.
 */
import type { MiddlewareHandler } from "hono";

export const captureRawBody: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "PATCH") {
    const raw = await c.req.raw.clone().text();
    c.set("rawBody", raw);
  }
  await next();
};
```

### 3. `src/services/webhooks/verify.ts`

```ts
/**
 * Verifier per provider — KHÔNG dùng `===` để compare HMAC.
 * timingSafeEqual chống timing attack (so từng byte mất thời gian khác nhau).
 */
import crypto from "node:crypto";
import { env } from "@/env";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// STRIPE: stripe-signature: t=<ts>,v1=<sig> — HMAC-SHA256(`${ts}.${rawBody}`, secret)
const STRIPE_TOLERANCE_SEC = 300;

export function verifyStripe(rawBody: string, sigHeader: string): {
  ok: boolean; reason?: string;
} {
  const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const ts = parts.t, sig = parts.v1;
  if (!ts || !sig) return { ok: false, reason: "BAD_HEADER" };

  const age = Math.floor(Date.now() / 1000) - Number(ts);
  if (Math.abs(age) > STRIPE_TOLERANCE_SEC) return { ok: false, reason: "TIMESTAMP_EXPIRED" };

  const expected = crypto.createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${ts}.${rawBody}`).digest("hex");
  return { ok: safeEqual(expected, sig) };
}

// GITHUB: x-hub-signature-256: sha256=<sig>
export function verifyGithub(rawBody: string, sigHeader: string): boolean {
  if (!sigHeader.startsWith("sha256=")) return false;
  const sig = sigHeader.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody).digest("hex");
  return safeEqual(expected, sig);
}

// SEPAY (API Key): Authorization: Apikey <SEPAY_API_KEY>
export function verifySePayApiKey(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith("Apikey ")) return false;
  return safeEqual(authHeader.slice("Apikey ".length), env.SEPAY_API_KEY);
}
```

### 4. `src/modules/webhook/routes.ts`

```ts
/**
 * Webhook receiver — 3 lớp bảo vệ:
 *  1) HMAC/API-Key verify (timingSafeEqual).
 *  2) Timestamp tolerance (chống replay).
 *  3) UNIQUE (provider, external_id) (chống duplicate).
 *
 * Quy tắc: ack 200 trong < 1s. Xử lý nặng → enqueue.
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "@/lib/db";
import { webhookEvents } from "@/db/schema/webhook-events";
import { captureRawBody } from "@/middlewares/raw-body";
import { verifyStripe, verifyGithub, verifySePayApiKey } from "@/services/webhooks/verify";
import { enqueueProcessWebhookEvent } from "@/jobs/process-webhook-event/queue";
import { logger } from "@/lib/logger";

const PG_UNIQUE_VIOLATION = "23505";

async function persistAndAck(
  c: Context, provider: string, externalId: string,
  eventType: string, payload: unknown,
) {
  try {
    const [row] = await db.insert(webhookEvents).values({
      provider, externalId, eventType,
      payload: payload as object, status: "received",
    }).returning({ id: webhookEvents.id });

    await enqueueProcessWebhookEvent({
      eventId: row.id, provider, externalId, eventType,
      dedupKey: `${provider}:${externalId}`,
    });
    return c.json({ success: true, id: row.id });
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      logger.info({ provider, externalId }, "webhook.duplicate-skipped");
      return c.json({ success: true, deduplicated: true });
    }
    throw err;
  }
}

export const webhookRoutes = new Hono()
  .use("*", captureRawBody)
  .post("/stripe", async (c) => {
    const raw = c.get("rawBody");
    const v = verifyStripe(raw, c.req.header("stripe-signature") ?? "");
    if (!v.ok) {
      logger.warn({ provider: "stripe", reason: v.reason }, "webhook.invalid");
      throw new HTTPException(400, { message: `INVALID_SIGNATURE:${v.reason}` });
    }
    const event = JSON.parse(raw) as { id: string; type: string };
    return persistAndAck(c, "stripe", event.id, event.type, event);
  })
  .post("/github", async (c) => {
    const raw = c.get("rawBody");
    if (!verifyGithub(raw, c.req.header("x-hub-signature-256") ?? "")) {
      throw new HTTPException(400, { message: "INVALID_SIGNATURE" });
    }
    return persistAndAck(c, "github",
      c.req.header("x-github-delivery") ?? "",
      c.req.header("x-github-event") ?? "unknown",
      JSON.parse(raw));
  })
  .post("/sepay", async (c) => {
    if (!verifySePayApiKey(c.req.header("authorization"))) {
      throw new HTTPException(401, { message: "INVALID_API_KEY" });
    }
    const p = JSON.parse(c.get("rawBody")) as { id: string | number; gateway: string };
    return persistAndAck(c, "sepay", String(p.id), "transaction", p);
  });
```

---

## Mount vào `src/app.ts`

```ts
import { webhookRoutes } from "@/modules/webhook/routes";

// Webhook KHÔNG dùng auth thường. Verify qua chữ ký.
app.route("/webhooks", webhookRoutes);
```

---

## Curl test (BẮT BUỘC)

```bash
# 1. Valid Stripe
TS=$(date +%s)
BODY='{"id":"evt_test_123","type":"payment_intent.succeeded"}'
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$STRIPE_WEBHOOK_SECRET" | awk '{print $2}')
curl -i -X POST http://localhost:3000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=$TS,v1=$SIG" -d "$BODY"
# → 200 { success: true }

# 2. Wrong signature → 400
curl -i -X POST http://localhost:3000/webhooks/stripe \
  -H "stripe-signature: t=$TS,v1=DEADBEEF" -d "$BODY"

# 3. Replay (TS > 5 phút trước) → 400 TIMESTAMP_EXPIRED
TS_OLD=$(($(date +%s) - 1000))
SIG_OLD=$(printf "%s.%s" "$TS_OLD" "$BODY" | openssl dgst -sha256 -hmac "$STRIPE_WEBHOOK_SECRET" | awk '{print $2}')
curl -i -X POST http://localhost:3000/webhooks/stripe \
  -H "stripe-signature: t=$TS_OLD,v1=$SIG_OLD" -d "$BODY"

# 4. Duplicate (gửi lại request 1) → 200 { deduplicated: true }

# 5. SePay sai API key → 401
curl -i -X POST http://localhost:3000/webhooks/sepay \
  -H "Authorization: Apikey WRONG" -d '{"id":1,"gateway":"VCB"}'
```

---

## Checklist cuối

- [ ] `captureRawBody` middleware mount TRƯỚC handler.
- [ ] Verify dùng `crypto.timingSafeEqual`, KHÔNG `===`.
- [ ] Stripe có timestamp tolerance 5 phút.
- [ ] Bảng `webhook_events` có UNIQUE (provider, external_id).
- [ ] Handler catch PG 23505 → trả deduplicated.
- [ ] Xử lý nặng đẩy queue, không sync trong handler.
- [ ] Response 200 trong < 1 giây (đo bằng time curl).
- [ ] File ≤ 300 dòng.
- [ ] Curl test đủ 4-5 case.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| HMAC luôn fail dù secret đúng | Body đã JSON.parse + stringify lại | Dùng `c.req.raw.clone().text()` trong middleware. |
| Replay attack pass | Không check timestamp | Tolerance 5 phút, reject ngoài range. |
| Duplicate xử lý 2 lần | Quên UNIQUE index | UNIQUE (provider, external_id), catch 23505. |
| Provider retry vô hạn | Ack chậm hoặc 5xx | Enqueue + return 200 ngay (< 1s). |
| Timing attack | Dùng `===` so HMAC | `crypto.timingSafeEqual` với Buffer cùng length. |
| Stripe-signature parse sai | Header có nhiều `v1=` (legacy) | Lấy `v1` đầu, hoặc Stripe official SDK. |
| SePay không nhận webhook | URL không có scheme đầy đủ | `https://example.com/webhooks/sepay`. |
| Worker xử lý lỗi → webhook stuck "received" | Worker không update status | Cron retry "received" > 1h, hoặc DLQ. |
| HMAC pass nhưng JSON.parse throw | Provider gửi body malformed | Trả 400 thay vì 500. |
