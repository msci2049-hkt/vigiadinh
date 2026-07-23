// WHY: enum là CONTRACT BE↔FE → nguồn duy nhất ở @/shared-contract.
import { z } from "zod";

export { type DeviceKind, deviceKindEnum } from "@/shared-contract";

export const guardianIdParam = z.object({
  guardianId: z.string().length(26), // ULID
});
