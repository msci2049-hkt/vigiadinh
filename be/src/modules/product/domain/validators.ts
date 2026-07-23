// WHY: Zod field/validator shared giữa nhiều feature trong module (status,
// id ULID). Mỗi feature có dto.ts riêng cho input shape; field reusable
// gom ở đây để 1 nguồn duy nhất.
import { z } from "zod";

export const productStatusEnum = z.enum(["active", "inactive", "archived"]);
export type ProductStatus = z.infer<typeof productStatusEnum>;

export const productIdParam = z.object({
  id: z.string().length(26), // ULID
});
