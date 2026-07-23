// WHY: enum là CONTRACT BE↔FE → nguồn duy nhất ở @/shared-contract (mirror CHECK
// trong infra/recovery-requests.schema.ts). LUẬT: risk score chỉ TRÌ HOÃN, không
// bao giờ tự cancel (rule security.md) — không có status "cancelled_by_risk".
import { z } from "zod";

export { type RecoveryStatus, recoveryStatusEnum } from "@/shared-contract";

export const walletIdParam = z.object({
  walletId: z.string().length(26), // ULID
});
