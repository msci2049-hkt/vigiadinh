// GET /api/intents/:intentId/signals — tín hiệu rủi ro deterministic quanh một
// lệnh chuyển (lô R2). KHÔNG LLM, KHÔNG số dư: chỉ con số về giao dịch, cho hai
// màn đang phải quyết — guardian duyệt hộ và chủ ví chờ duyệt.
//
// Authz: chủ ví (đúng scope passkey) HOẶC guardian hiệu lực của ví. Người thứ
// ba → 403. Logic nằm ở read-intent.ts, dùng chung với /explain.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { computeIntentSignals, loadReadableIntent } from "./read-intent";

const signalsParam = z.object({ intentId: z.string().length(26) });

export const intentSignalsRoute = new Hono().get(
  "/:intentId/signals",
  requireAuth,
  zv("param", signalsParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { intentId } = c.req.valid("param");
    const intent = await loadReadableIntent(intentId, user.id, c.get("session"));
    return c.json({ data: await computeIntentSignals(intent) });
  },
);
