// DTO luồng ghi recovery on-chain (PHA 5.2). Địa chỉ Stellar: G (classic) hoặc
// C (contract) — cả hai đều hợp lệ làm new_owner (ví mới có thể là smart account).
import { z } from "zod";

const stellarAddress = z.string().regex(/^[GC][A-Z2-7]{55}$/, "địa chỉ Stellar không hợp lệ");

export const buildActionBody = z.object({
  wallet_id: z.string().length(26),
  /** Chỉ initiate cần: địa chỉ chủ mới đề cử. */
  new_owner: stellarAddress.optional(),
});

export const submitBody = z.object({
  wallet_id: z.string().length(26),
  /** Auth entries ĐÃ KÝ, mỗi phần tử một entry base64 (đúng shape build trả về). */
  signed_entries: z.array(z.string().min(1)).min(1).max(3),
});

export const finalizeBody = z.object({
  wallet_id: z.string().length(26),
});

export type BuildActionBody = z.infer<typeof buildActionBody>;
export type SubmitBody = z.infer<typeof submitBody>;
