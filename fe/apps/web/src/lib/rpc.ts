import type { Hono } from "hono";
import { hc } from "hono/client";
import { env } from "./env";

/**
 * Hono RPC client — OPTIONAL, scaffold only.
 * ---------------------------------------------------------------------------
 * This template is BE-agnostic and must build WITHOUT the backend, so the app
 * type is a blank placeholder here (`hc<Hono>` = no typed routes yet). For
 * everyday calls use `apiClient` (./api-client) and Better Auth (./auth-client).
 *
 * To get end-to-end types from your BE, replace the placeholder below with the
 * backend's exported `AppType`, using ONE of these:
 *
 *   (a) Sibling repo via tsconfig path alias (BE checked out next to FE):
 *         // tsconfig.app.json -> "paths": { "@be/*": ["../<be-repo>/src/*"] }
 *         import type { AppType } from "@be/index";
 *
 *   (b) Published types package from the BE:
 *         pnpm add -D @your-org/api-types
 *         import type { AppType } from "@your-org/api-types";
 *
 *   (c) No shared types? Fall back to Orval against the BE OpenAPI spec, or a
 *       shared Zod-schema package, and keep using apiClient.
 *
 * Then change `Hono` below to `AppType` and you get typed `rpc.<route>.$get()`.
 * ---------------------------------------------------------------------------
 */
type AppType = Hono;

export const rpc = hc<AppType>(env.VITE_API_URL, {
  // Send the session cookie with every RPC call (matches api-client).
  fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" })) as typeof fetch,
});
