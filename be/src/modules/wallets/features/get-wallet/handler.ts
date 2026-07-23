// KHUNG — ownership check ngay từ skeleton: tìm theo (id, userId), không thấy
// = 404 (không phân biệt "không tồn tại" vs "không phải của mày" — tránh leak).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { WALLET_ERRORS } from "../../domain/errors";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/wallets.repository";

export const getWalletRoute = new Hono().get(
  "/:id",
  requireAuth,
  zv("param", walletIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { id } = c.req.valid("param");
    const wallet = await repo.findByIdForUser(id, user.id);
    if (!wallet) throw new HTTPException(404, { message: WALLET_ERRORS.NOT_FOUND });
    return c.json({ data: wallet });
  },
);
