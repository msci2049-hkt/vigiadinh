import { Hono } from "hono";
import { guardianInvitesRoute } from "./features/invites/handler";
import { listGuardiansRoute } from "./features/list-guardians/handler";

export const guardiansRoutes = new Hono()
  .route("/", listGuardiansRoute)
  .route("/", guardianInvitesRoute);
