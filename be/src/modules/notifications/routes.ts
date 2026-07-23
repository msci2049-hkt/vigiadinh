import { Hono } from "hono";
import { listNotificationsRoute } from "./features/list-notifications/handler";

export const notificationsRoutes = new Hono().route("/", listNotificationsRoute);
