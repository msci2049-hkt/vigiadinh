// KHUNG — gửi thật (FCM/APNs/email) qua BullMQ worker, dựng theo skill
// fw-indexer-notify. Route này chỉ đọc hộp thông báo của CHÍNH user.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/notifications.repository";
import { listNotificationsQuery } from "./dto";

export const listNotificationsRoute = new Hono().get(
  "/",
  requireAuth,
  zv("query", listNotificationsQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { status } = c.req.valid("query");
    // `status` đi THẲNG vào WHERE của SQL. Lọc ở đây (sau LIMIT 100) là bug:
    // xem chú thích ở notifications.repository.listByUser.
    const items = await repo.listByUser(user.id, status);
    return c.json({ data: items });
  },
);
