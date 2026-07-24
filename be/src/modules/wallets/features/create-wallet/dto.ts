// DTO tạo ví (PHA 6 setup mức A). FE đã deploy smart account qua kit (passkey +
// wasm hash), gửi ĐỊA CHỈ ví C… về đây để BE mirror. BE KHÔNG deploy, KHÔNG giữ
// khoá — chỉ ghi nhận ví thuộc user (custody vẫn trên chuỗi).
import { z } from "zod";

export const createWalletBody = z.object({
  /** Địa chỉ smart account đã deploy (C…). */
  stellar_address: z.string().regex(/^C[A-Z2-7]{55}$/, "địa chỉ ví không hợp lệ"),
  /** Múi giờ IANA của chủ ví — cron ping 12:00 chạy theo giờ này (PHA 4). */
  timezone: z.string().min(1).max(40).default("UTC"),
});

export type CreateWalletBody = z.infer<typeof createWalletBody>;
