// WHY: Chỉ compose feature routes — KHÔNG business logic.
// Thứ tự mount: đường TĨNH (/send/*, /pending-approvals) đăng ký TRƯỚC đường
// động /:intentId/cancel — Hono match theo thứ tự, để "/send" không bị nuốt
// làm :intentId.
import { Hono } from "hono";
import { cancelIntentRoute } from "./features/cancel-intent/handler";
import { createIntentRoute } from "./features/create-intent/handler";
import { pendingApprovalsRoute } from "./features/pending-approvals/handler";
import { sendFlowRoute } from "./features/send-flow/handler";

export const intentsRoutes = new Hono()
  .route("/", createIntentRoute)
  .route("/", sendFlowRoute)
  .route("/", pendingApprovalsRoute)
  .route("/", cancelIntentRoute);
