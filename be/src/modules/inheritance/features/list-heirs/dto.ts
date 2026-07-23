import { z } from "zod";
import { bpsField } from "../../domain/validators";

// Input cho feature set-heirs (dựng sau) — khai ở đây để test chốt contract bps.
export const heirInput = z.object({
  heirRef: z.string().min(1).max(64),
  bps: bpsField,
});

export type HeirInput = z.infer<typeof heirInput>;
