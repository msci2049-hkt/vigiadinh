// WHY: Public facade. Consumer NGOÀI module CHỈ import từ "@/modules/product"
// (path này). Deep import vào features/, infra/, domain/ → script
// check:boundaries fail (xem .claude/rules/module-boundary.md).
//
// Side-effect import integration-events để module augmentation @/lib/events
// được load — đảm bảo subscriber có type cho `product.*`.
import "./integration-events";

export type { NewProduct, Product, ProductStatus } from "./domain/product.entity";
