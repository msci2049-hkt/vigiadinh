import { Hono } from "hono";
import { ackRoute } from "./features/ack/handler";
import { listPingsRoute } from "./features/list-pings/handler";

export const presenceRoutes = new Hono().route("/", listPingsRoute).route("/", ackRoute);
