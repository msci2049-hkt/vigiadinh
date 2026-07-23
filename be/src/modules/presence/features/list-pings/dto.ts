import { z } from "zod";

export const listPingsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListPingsQuery = z.infer<typeof listPingsQuery>;
