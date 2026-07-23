// KHUNG — ping 12:00 thật cần cron BullMQ repeatable (template CHƯA có, dựng
// theo skill new-cron + fw-guardian-presence; queue name bắt buộc {hashtag}).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { guardianIdParam } from "../../domain/validators";
import * as repo from "../../infra/presence.repository";
import { listPingsQuery } from "./dto";

export const listPingsRoute = new Hono().get(
  "/guardian/:guardianId",
  requireAuth,
  zv("param", guardianIdParam),
  zv("query", listPingsQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { guardianId } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const items = await repo.listPingsByGuardianForOwner(guardianId, user.id, limit);
    return c.json({ data: items });
  },
);
