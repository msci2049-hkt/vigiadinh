// WHY: Type public của entity Product — consumer ngoài module chỉ import
// type này qua `@/modules/product` (index.ts), KHÔNG import infra trực tiếp.
// Drizzle pattern: type inferred từ schema, domain re-export.
export type { NewProduct, Product } from "../infra/products.schema";
export type { ProductStatus } from "./validators";
