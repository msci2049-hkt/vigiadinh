// KHUNG (skeleton) — logic thật dựng theo skill fw-passkey-auth + fw-soroban-contracts.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/wallets.repository";
import { listWalletsQuery } from "./dto";

export const listWalletsRoute = new Hono().get(
  "/",
  requireAuth,
  zv("query", listWalletsQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { limit } = c.req.valid("query");
    const items = await repo.listByUser(user.id, limit);
    return c.json({ data: items });
  },
);
