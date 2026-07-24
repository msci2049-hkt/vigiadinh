// DTO tạo intent (PHA 3.3). client_intent_id = UUID CLIENT sinh (A3) — không
// timestamp/random phía server (idempotency phải là business identity từ client).
import { z } from "zod";

export const createIntentInput = z.object({
  wallet_id: z.string().length(26),
  client_intent_id: z.uuid(),
  // Danh sách operation khai báo — validate sâu ở PHA 5 khi build tx thật.
  operations: z.array(z.record(z.string(), z.unknown())).min(1).max(10),
  recipient: z
    .string()
    .regex(/^[GC][A-Z2-7]{55}$/, "recipient phải là địa chỉ Stellar (G... hoặc C...)")
    .optional(),
  // STROOPS dạng chuỗi số (JSON không chở bigint an toàn) — service đổi BigInt.
  amount: z
    .string()
    .regex(/^[1-9][0-9]{0,18}$/, "amount phải là stroops nguyên dương")
    .optional(),
});
export type CreateIntentInput = z.infer<typeof createIntentInput>;
