import { z } from "zod";
import { guardianStatusEnum } from "../../domain/validators";

export const listGuardiansQuery = z.object({
  status: guardianStatusEnum.optional(),
});

export type ListGuardiansQuery = z.infer<typeof listGuardiansQuery>;
