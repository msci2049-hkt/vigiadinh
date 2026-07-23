import { z } from "zod";

export const listAuditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAuditQuery = z.infer<typeof listAuditQuery>;
