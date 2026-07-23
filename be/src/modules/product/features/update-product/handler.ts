import { Hono } from "hono";
import { eventBus } from "@/lib/events";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { productIdParam } from "../../domain/validators";
import * as repo from "../../infra/product.repository";
import { updateProductInput } from "./dto";

export const updateProductRoute = new Hono().patch(
  "/:id",
  requireAuth,
  zv("param", productIdParam),
  zv("json", updateProductInput),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const product = await repo.update(id, input);
    eventBus.emit("product.updated", { productId: product.id, changes: input });
    return c.json({ data: product });
  },
);
