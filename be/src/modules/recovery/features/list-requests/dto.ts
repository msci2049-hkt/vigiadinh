import { z } from "zod";
import { recoveryStatusEnum } from "../../domain/validators";

export const listRequestsQuery = z.object({
  status: recoveryStatusEnum.optional(),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuery>;
