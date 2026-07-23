import { Hono } from "hono";
import { eventBus } from "@/lib/events";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { productIdParam } from "../../domain/validators";
import * as repo from "../../infra/product.repository";

export const deleteProductRoute = new Hono().delete(
  "/:id",
  requireAuth,
  zv("param", productIdParam),
  async (c) => {
    const { id } = c.req.valid("param");
    await repo.remove(id);
    eventBus.emit("product.deleted", { productId: id });
    return c.body(null, 204);
  },
);
