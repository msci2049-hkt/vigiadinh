import { z } from "zod";

// basis points: 10000 = 100%. Tổng mọi heir của 1 ví = 10000 — ràng buộc TẦNG
// SERVICE (INHERITANCE_ERRORS.BPS_SUM_INVALID), CHECK per-row chỉ 0..10000.
export const bpsField = z.number().int().min(0).max(10000);

export const walletIdParam = z.object({
  walletId: z.string().length(26), // ULID
});
