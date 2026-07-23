import { Hono } from "hono";
import { getEngineStatusRoute } from "./features/get-engine-status/handler";

export const riskRoutes = new Hono().route("/", getEngineStatusRoute);
