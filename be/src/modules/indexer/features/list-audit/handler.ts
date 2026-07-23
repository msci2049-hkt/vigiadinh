// KHUNG — poll getEvents + checkpoint dựng theo skill fw-indexer-notify.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/indexer.repository";
import { listAuditQuery } from "./dto";

export const listAuditRoute = new Hono().get(
  "/wallet/:walletId",
  requireAuth,
  zv("param", walletIdParam),
  zv("query", listAuditQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const items = await repo.listByWalletForOwner(walletId, user.id, limit);
    return c.json({ data: items });
  },
);
