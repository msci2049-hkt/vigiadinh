// POST /api/presence/ack — máy guardian trả lời silent ping (chạy nền, người
// không bị phiền). Một chạm cập nhật MỌI dòng guardian của user (một người có
// thể bảo hộ nhiều ví). POST /api/presence/confirm — xác nhận TAY 90 ngày.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { ackPresence, manualConfirm } from "../../infra/ladder.repository";

export const ackRoute = new Hono()
  .post("/ack", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const updated = await ackPresence(user.id, new Date());
    return c.json({ data: { acked: updated.length } });
  })
  .post("/confirm", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const confirmed = await manualConfirm(user.id, new Date());
    return c.json({ data: { confirmed } });
  });
