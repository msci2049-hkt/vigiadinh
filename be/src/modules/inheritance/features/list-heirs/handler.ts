// KHUNG — heartbeat + heir claim on-chain dựng theo skill fw-soroban-contracts
// (contract inheritance viết mới). BE mirror + nhắc heartbeat qua notifications.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/inheritance.repository";

export const listHeirsRoute = new Hono().get(
  "/wallet/:walletId",
  requireAuth,
  zv("param", walletIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const items = await repo.listHeirsByWalletForOwner(walletId, user.id);
    return c.json({ data: items });
  },
);
