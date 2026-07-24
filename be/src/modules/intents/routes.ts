// WHY: Chỉ compose feature routes — KHÔNG business logic.
import { Hono } from "hono";
import { createIntentRoute } from "./features/create-intent/handler";

export const intentsRoutes = new Hono().route("/", createIntentRoute);
