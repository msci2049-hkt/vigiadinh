import { z } from "zod";
import { MAX_GUARDIANS, MIN_THRESHOLD, TIMELOCK_CHOICES_SECS } from "./domain";

/** Cả hai trường optional — màn ngưỡng và màn thời gian chờ gửi riêng lẻ. */
export const recoveryConfigBody = z.object({
  threshold: z.number().int().min(MIN_THRESHOLD).max(MAX_GUARDIANS).optional(),
  timelock_secs: z
    .number()
    .int()
    .refine((v) => (TIMELOCK_CHOICES_SECS as readonly number[]).includes(v), {
      message: "thời gian chờ không nằm trong danh sách cho phép",
    })
    .optional(),
});
