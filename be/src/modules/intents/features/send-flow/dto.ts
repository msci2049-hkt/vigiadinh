// DTO luồng gửi tiền (PHA 6 SEND). amount = chuỗi stroops (BigInt qua JSON an
// toàn — không mất chính xác như number). recipient G/C đều hợp lệ.
import { z } from "zod";

const stellarAddress = z.string().regex(/^[GC][A-Z2-7]{55}$/, "địa chỉ Stellar không hợp lệ");
const stroops = z.string().regex(/^[1-9][0-9]{0,24}$/, "số stroops không hợp lệ");

export const prepareSendBody = z.object({
  wallet_id: z.string().length(26),
  client_intent_id: z.string().min(1).max(64),
  recipient: stellarAddress,
  amount: stroops,
});

export const confirmSendBody = z.object({
  intent_id: z.string().length(26),
});

export const signSendBody = z.object({
  intent_id: z.string().length(26),
  signed_entries: z.array(z.string().min(1)).min(1).max(2),
});

export const guardianApproveBody = z.object({
  intent_id: z.string().length(26),
  verified_call: z.boolean(),
  // default "approved" — client cũ (chưa gửi trường này) giữ nguyên hành vi duyệt.
  decision: z.enum(["approved", "rejected"]).default("approved"),
});

export type PrepareSendBody = z.infer<typeof prepareSendBody>;
