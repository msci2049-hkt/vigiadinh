// WHY: Chỉ compose feature routes — KHÔNG business logic.
// Thứ tự mount: đường TĨNH (/send/*, /pending-approvals, /pending-signature)
// đăng ký TRƯỚC đường động /:intentId/cancel — Hono match theo thứ tự, để
// "/send" không bị nuốt làm :intentId.
import { Hono } from "hono";
import { cancelIntentRoute } from "./features/cancel-intent/handler";
import { createIntentRoute } from "./features/create-intent/handler";
import { intentExplainRoute } from "./features/explain/handler";
import { pendingApprovalsRoute } from "./features/pending-approvals/handler";
import { pendingSignatureRoute } from "./features/pending-signature/handler";
import { sendFlowRoute } from "./features/send-flow/handler";
import { intentSignalsRoute } from "./features/signals/handler";

export const intentsRoutes = new Hono()
  .route("/", createIntentRoute)
  .route("/", sendFlowRoute)
  .route("/", pendingApprovalsRoute)
  .route("/", pendingSignatureRoute)
  .route("/", intentSignalsRoute)
  .route("/", intentExplainRoute)
  .route("/", cancelIntentRoute);
