// Error envelope chuẩn của API (app.onError) — FE parse theo shape này.
import { z } from "zod";

export const apiErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelope>;
