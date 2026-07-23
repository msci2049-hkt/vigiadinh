import { z } from "zod";

export const walletIdParam = z.object({
  walletId: z.string().length(26), // ULID
});
