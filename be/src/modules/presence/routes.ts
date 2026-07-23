import { Hono } from "hono";
import { listPingsRoute } from "./features/list-pings/handler";

export const presenceRoutes = new Hono().route("/", listPingsRoute);
