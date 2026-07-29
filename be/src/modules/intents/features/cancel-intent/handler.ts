// POST /api/intents/:intentId/cancel — route mỏng, logic ở service (test trực tiếp).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { CancelError, cancelIntent } from "./service";

const cancelLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "intent-cancel",
  failOpen: false,
});

const idParam = z.object({ intentId: z.string().length(26) });

export const cancelIntentRoute = new Hono().post(
  "/:intentId/cancel",
  requireAuth,
  cancelLimit,
  zv("param", idParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { intentId } = c.req.valid("param");
    const result = await cancelIntent({
      intentId,
      userId: user.id,
      sessionWalletScope: c.get("session")?.activeWalletId ?? null,
    }).catch((err) => {
      if (err instanceof CancelError) throw new HTTPException(err.status, { message: err.message });
      throw err;
    });
    return c.json({ data: result });
  },
);
