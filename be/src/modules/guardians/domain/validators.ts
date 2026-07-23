// WHY: enum trạng thái là CONTRACT BE↔FE → nguồn duy nhất ở @/shared-contract
// (mirror CHECK constraint trong infra/guardians.schema.ts). Ở đây chỉ re-export
// + validator cục bộ của module.
import { z } from "zod";

export { type GuardianStatus, guardianStatusEnum } from "@/shared-contract";

export const walletIdParam = z.object({
  walletId: z.string().length(26), // ULID
});
