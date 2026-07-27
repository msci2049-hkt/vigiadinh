// KHUNG — poll getEvents + checkpoint dựng theo skill fw-indexer-notify.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/indexer.repository";
import { decodeCursor, encodeCursor, listAuditQuery } from "./dto";

export const listAuditRoute = new Hono().get(
  "/wallet/:walletId",
  requireAuth,
  zv("param", walletIdParam),
  zv("query", listAuditQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const { limit, cursor } = c.req.valid("query");

    // Con trỏ hỏng → 400. KHÔNG rơi về trang đầu: làm vậy thì client lật trang mãi
    // không hết mà không có tín hiệu nào báo sai.
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    if (cursor && !decoded) throw new HTTPException(400, { message: "INVALID_CURSOR" });

    const page = await repo.listByWalletForOwner(walletId, user.id, limit, decoded ?? undefined);
    // Nhật ký ví = dữ liệu riêng tư, và trang sau phụ thuộc con trỏ → không cache.
    c.header("Cache-Control", "no-store");
    return c.json({
      data: page.items,
      next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  },
);
