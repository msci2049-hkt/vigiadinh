import { Hono } from "hono";
import { heartbeatRoute } from "./features/heartbeat/handler";
import { listHeirsRoute } from "./features/list-heirs/handler";

export const inheritanceRoutes = new Hono().route("/", listHeirsRoute).route("/", heartbeatRoute);
