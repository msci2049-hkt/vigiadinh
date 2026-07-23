// WHY: Wire 5 feature route vào 1 Hono instance. Mỗi feature self-contained
// (handler.ts + dto.ts) — file này chỉ compose, KHÔNG có business logic.
//
// Side-effect import integration-events để TS pick up module augmentation
// trên @/lib/events (subscriber có type "product.created" v.v.).
import { Hono } from "hono";
import "./integration-events";
import { createProductRoute } from "./features/create-product/handler";
import { deleteProductRoute } from "./features/delete-product/handler";
import { getProductRoute } from "./features/get-product/handler";
import { listProductsRoute } from "./features/list-products/handler";
import { updateProductRoute } from "./features/update-product/handler";

export const productRoutes = new Hono()
  .route("/", listProductsRoute)
  .route("/", createProductRoute)
  .route("/", getProductRoute)
  .route("/", updateProductRoute)
  .route("/", deleteProductRoute);
