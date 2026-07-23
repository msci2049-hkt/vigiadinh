// WHY: 1 nơi map domain string → HTTP status. Service throw `new Error("X")`,
// route KHÔNG try/catch. Response error shape duy nhất:
//   { error: { code, message, details? } }
//
// Thứ tự match QUAN TRỌNG (sửa cẩn thận):
//   1 HTTPException · 2 ZodError · 3 ERROR_MAP · 4 *_NOT_FOUND · 5 *_ALREADY_EXISTS
//   6 BrokenCircuitError · 7 PG code · 8 Unknown → 500 + Sentry
//
// Sentry CHỈ capture branch 8 — capture HTTPException/ZodError tạo noise.

import { BrokenCircuitError } from "cockatiel";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { Sentry } from "@/lib/sentry";

const ERROR_MAP: Record<string, ContentfulStatusCode> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN_ROLE: 403,
  NO_ACTIVE_ORG: 403,
  NOT_OWNER: 403,
  RATE_LIMITED: 429,
  RATE_LIMIT_STORE_DOWN: 429,
  MIME_NOT_ALLOWED: 400,
  FILE_TOO_LARGE: 413,
  MISSING_FILE: 400,
};

const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";

export const errorHandler: ErrorHandler = (err, c) => {
  const reqId = c.req.header("x-request-id") ?? null;
  const ctx = { reqId, path: c.req.path, method: c.req.method };

  if (err instanceof HTTPException) {
    const code = err.message || "HTTP_ERROR";
    return c.json({ error: { code, message: code } }, err.status);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Input validation failed", details } },
      400,
    );
  }

  const msg = err.message ?? "";
  const prefix = msg.split(":")[0] ?? msg; // "PERMANENT:X" → "PERMANENT"
  const mapped = ERROR_MAP[msg] ?? ERROR_MAP[prefix];
  if (mapped !== undefined) {
    return c.json({ error: { code: msg, message: msg } }, mapped);
  }

  if (/_NOT_FOUND$/.test(msg)) return c.json({ error: { code: msg, message: msg } }, 404);
  if (/_ALREADY_EXISTS$/.test(msg)) return c.json({ error: { code: msg, message: msg } }, 409);

  if (err instanceof BrokenCircuitError) {
    logger.warn({ ...ctx, err: err.message }, "circuit.open.refuse");
    return c.json({ error: { code: "BROKEN_CIRCUIT", message: "Upstream unavailable" } }, 503);
  }

  const pgCode = (err as { code?: string }).code;
  if (pgCode === PG_UNIQUE_VIOLATION) {
    return c.json({ error: { code: "ALREADY_EXISTS", message: "Resource already exists" } }, 409);
  }
  if (pgCode === PG_FK_VIOLATION) {
    return c.json(
      { error: { code: "FK_VIOLATION", message: "Referenced resource not found" } },
      409,
    );
  }

  logger.error({ ...ctx, err }, "unhandled.error");
  const eventId = Sentry.captureException(err, {
    tags: { path: c.req.path, method: c.req.method },
    extra: { reqId },
  });
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
        details: { sentryEventId: eventId },
      },
    },
    500,
  );
};
