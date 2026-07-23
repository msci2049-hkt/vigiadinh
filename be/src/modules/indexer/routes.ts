import { Hono } from "hono";
import { listAuditRoute } from "./features/list-audit/handler";

export const indexerRoutes = new Hono().route("/", listAuditRoute);
