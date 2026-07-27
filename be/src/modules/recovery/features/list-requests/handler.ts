// KHUNG — luồng khôi phục thật: contract gate (Soroban) + client submit
// SetOptions (skill fw-soroban-contracts). BE chỉ mirror + notify.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/recovery.repository";
import { listRequestsQuery } from "./dto";

export const listRequestsRoute = new Hono().get(
  "/wallet/:walletId",
  requireAuth,
  zv("param", walletIdParam),
  zv("query", listRequestsQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const { status } = c.req.valid("query");
    // `status` vào thẳng WHERE — xem chú thích ở recovery.repository.
    const items = await repo.listByWalletForOwner(walletId, user.id, status);
    return c.json({ data: items });
  },
);
