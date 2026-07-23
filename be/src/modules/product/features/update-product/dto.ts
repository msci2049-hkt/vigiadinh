import { z } from "zod";
import { productStatusEnum } from "../../domain/validators";

// WHY: KHÔNG dùng `.partial()` của createProductInput vì các default() (status,
// stock) sẽ vẫn được Zod inject vào output → empty body `{}` parse ra
// `{stock:0,status:"active"}` → refine "at least 1 field" mất tác dụng + risk
// reset stock về 0 khi PATCH name. Định nghĩa lại optional + refine.
export const updateProductInput = z
  .object({
    name: z.string().min(1).max(200).optional(),
    price: z.number().int().positive().optional(),
    stock: z.number().int().min(0).optional(),
    status: productStatusEnum.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "At least one field required");

export type UpdateProductInput = z.infer<typeof updateProductInput>;
