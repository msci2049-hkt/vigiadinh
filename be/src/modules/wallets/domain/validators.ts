// WHY: Zod field shared giữa các feature trong module.
import { z } from "zod";

export const walletIdParam = z.object({
  id: z.string().length(26), // ULID
});
