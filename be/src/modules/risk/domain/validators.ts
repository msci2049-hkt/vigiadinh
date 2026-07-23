import { z } from "zod";

export const requestIdParam = z.object({
  requestId: z.string().length(26), // ULID — recovery_requests.id
});
