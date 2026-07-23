import { Hono } from "hono";
import { eventBus } from "@/lib/events";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/product.repository";
import { createProductInput } from "./dto";

export const createProductRoute = new Hono().post(
  "/",
  requireAuth,
  zv("json", createProductInput),
  async (c) => {
    const input = c.req.valid("json");
    const product = await repo.insert(input);
    eventBus.emit("product.created", {
      productId: product.id,
      name: product.name,
      priceCents: product.price,
    });
    return c.json({ data: product }, 201);
  },
);
