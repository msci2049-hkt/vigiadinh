import { Hono } from "hono";
import { listGuardiansRoute } from "./features/list-guardians/handler";

export const guardiansRoutes = new Hono().route("/", listGuardiansRoute);
