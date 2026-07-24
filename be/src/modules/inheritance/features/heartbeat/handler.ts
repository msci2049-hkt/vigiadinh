// POST /api/inheritance/heartbeat — chạm "tôi vẫn ổn" của CHỦ VÍ: ghi beat,
// reset thang leo, audit. Ownership lớp 2 trong repository.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { recordHeartbeat } from "../../infra/heartbeat.repository";

const heartbeatInput = z.object({ wallet_id: z.string().length(26) });

export const heartbeatRoute = new Hono().post(
  "/heartbeat",
  requireAuth,
  zv("json", heartbeatInput),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { wallet_id } = c.req.valid("json");
    const ok = await recordHeartbeat(wallet_id, user.id, new Date());
    if (!ok) throw new HTTPException(403, { message: "NOT_OWNER" });
    return c.json({ data: { ok: true } });
  },
);
