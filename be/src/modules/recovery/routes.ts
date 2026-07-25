import { Hono } from "hono";
import { chainTruthRoute } from "./features/chain-truth/handler";
import { guardianInboxRoute } from "./features/guardian-inbox/handler";
import { listRequestsRoute } from "./features/list-requests/handler";
import { onchainActionsRoute } from "./features/onchain-actions/handler";
import { publicRecoveryRoute } from "./features/public-recovery/handler";

export const recoveryRoutes = new Hono()
  .route("/", listRequestsRoute)
  .route("/", guardianInboxRoute)
  .route("/", publicRecoveryRoute)
  .route("/", chainTruthRoute)
  .route("/", onchainActionsRoute);
