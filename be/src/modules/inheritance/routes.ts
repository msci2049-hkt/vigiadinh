import { Hono } from "hono";
import { getPlanRoute } from "./features/get-plan/handler";
import { heartbeatRoute } from "./features/heartbeat/handler";
import { listHeirsRoute } from "./features/list-heirs/handler";

// getPlanRoute TRƯỚC listHeirsRoute: cả hai match "/wallet/:walletId..." nhưng
// path cụ thể hơn (".../plan") phải đăng ký trước để không bị nuốt.
export const inheritanceRoutes = new Hono()
  .route("/", getPlanRoute)
  .route("/", listHeirsRoute)
  .route("/", heartbeatRoute);
