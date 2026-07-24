import { Hono } from "hono";
import { guardianInboxRoute } from "./features/guardian-inbox/handler";
import { listRequestsRoute } from "./features/list-requests/handler";
import { onchainActionsRoute } from "./features/onchain-actions/handler";

export const recoveryRoutes = new Hono()
  .route("/", listRequestsRoute)
  .route("/", guardianInboxRoute)
  .route("/", onchainActionsRoute);
