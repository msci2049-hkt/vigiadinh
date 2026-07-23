import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zv } from "@/middlewares/validator";
import { productIdParam } from "../../domain/validators";
import * as repo from "../../infra/product.repository";

export const getProductRoute = new Hono().get("/:id", zv("param", productIdParam), async (c) => {
  const { id } = c.req.valid("param");
  // 404 cho inactive/archived dùng CHUNG message với "not found" thật —
  // tránh leak catalog state ra client (unauth không biết product có tồn
  // tại nhưng ẩn hay không).
  const product = await repo.findActiveById(id);
  if (!product) throw new HTTPException(404, { message: "PRODUCT_NOT_FOUND" });
  return c.json({ data: product });
});
