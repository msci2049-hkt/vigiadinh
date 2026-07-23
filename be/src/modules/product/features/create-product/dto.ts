import { z } from "zod";
import { productStatusEnum } from "../../domain/validators";

export const createProductInput = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().positive(),
  stock: z.number().int().min(0).default(0),
  status: productStatusEnum.default("active"),
});

export type CreateProductInput = z.infer<typeof createProductInput>;
