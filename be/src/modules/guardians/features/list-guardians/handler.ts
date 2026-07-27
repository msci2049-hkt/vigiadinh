// KHUNG — logic thật (mời, ngưỡng, presence) dựng theo skill fw-guardian-presence.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/guardians.repository";
import { listGuardiansQuery } from "./dto";

export const listGuardiansRoute = new Hono().get(
  "/wallet/:walletId",
  requireAuth,
  zv("param", walletIdParam),
  zv("query", listGuardiansQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const { status } = c.req.valid("query");
    // `status` vào thẳng WHERE — xem chú thích ở guardians.repository.
    const items = await repo.listByWalletForOwner(walletId, user.id, status);
    return c.json({ data: items });
  },
);
