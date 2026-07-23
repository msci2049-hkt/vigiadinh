import { z } from "zod";

export const listWalletsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListWalletsQuery = z.infer<typeof listWalletsQuery>;
