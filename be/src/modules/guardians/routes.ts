import { Hono } from "hono";
import { guardianInvitesRoute } from "./features/invites/handler";
import { listGuardiansRoute } from "./features/list-guardians/handler";
import { listProtectingRoute } from "./features/list-protecting/handler";

export const guardiansRoutes = new Hono()
  .route("/", listGuardiansRoute)
  .route("/", listProtectingRoute)
  .route("/", guardianInvitesRoute);
