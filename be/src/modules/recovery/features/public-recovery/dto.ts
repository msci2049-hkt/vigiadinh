// DTO luồng khôi phục PUBLIC (người mất máy CHƯA có session — chủ ý public,
// xem fe CLAUDE.md nhóm 5). Mọi input từ kẻ lạ → validate chặt + anti-enumeration.
import { z } from "zod";

export const deviceRequestBody = z.object({
  /** Địa chỉ ví cần khôi phục — C… (smart account). */
  wallet_address: z.string().regex(/^C[A-Z2-7]{55}$/, "địa chỉ ví không hợp lệ"),
  /** Verifier của khoá mới (origin-verifier passkey / ed25519). */
  verifier: z.string().regex(/^C[A-Z2-7]{55}$/, "địa chỉ verifier không hợp lệ"),
  /** Public key khoá mới, base64 (32..96 byte sau decode — domain kiểm). */
  key_base64: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64 không hợp lệ")
    .min(40)
    .max(160),
});

export const progressQuery = z.object({
  address: z.string().regex(/^[GC][A-Z2-7]{55}$/, "địa chỉ không hợp lệ"),
});

export type DeviceRequestBody = z.infer<typeof deviceRequestBody>;
