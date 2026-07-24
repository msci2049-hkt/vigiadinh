// DTO luồng ghi recovery on-chain (PHA 5.2, v2 audit P0). Khôi phục ví contract =
// cài KHOÁ MỚI vào smart account — initiate chở vật liệu signer thật (verifier +
// public key), không phải "địa chỉ chủ mới" như registry v1.
import { z } from "zod";

const contractAddress = z.string().regex(/^C[A-Z2-7]{55}$/, "địa chỉ contract không hợp lệ");

export const buildActionBody = z.object({
  wallet_id: z.string().length(26),
  /** Chỉ initiate cần: verifier của khoá mới (origin-verifier passkey hoặc ed25519). */
  new_signer_verifier: contractAddress.optional(),
  /** Chỉ initiate cần: public key khoá mới, base64 (ed25519 32B / secp256r1 65B). */
  new_signer_key: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64 không hợp lệ")
    .min(40)
    .max(160)
    .optional(),
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
