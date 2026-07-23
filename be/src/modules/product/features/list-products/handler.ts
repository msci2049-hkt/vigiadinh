import { Hono } from "hono";
import * as repo from "../../infra/product.repository";

export const listProductsRoute = new Hono().get("/", async (c) => {
  const items = await repo.listActive();
  return c.json({ data: items });
});
