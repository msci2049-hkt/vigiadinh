import { Hono } from "hono";
import { listHeirsRoute } from "./features/list-heirs/handler";

export const inheritanceRoutes = new Hono().route("/", listHeirsRoute);
