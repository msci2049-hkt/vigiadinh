import { Hono } from "hono";
import { listRequestsRoute } from "./features/list-requests/handler";

export const recoveryRoutes = new Hono().route("/", listRequestsRoute);
