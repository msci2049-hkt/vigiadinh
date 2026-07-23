// WHY: Bảng `products` — catalog sản phẩm public.
// - price/stock: integer (cents) tránh sai số float (rule payment.md).
// - status: varchar + Zod enum, KHÔNG pgEnum (rule db-schema.md).
// - Index status: query "list active products" là path nóng.
//
// Slice pattern: schema sống TRONG module (infra/), re-export ở
// src/db/schema/index.ts để drizzle-kit nhìn thấy.
import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const products = pgTable(
  "products",
  {
    id: varchar("id", { length: 26 })
      .primaryKey()
      .$defaultFn(() => ulid()),
    name: varchar("name", { length: 200 }).notNull(),
    price: integer("price").notNull(),
    stock: integer("stock").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("products_status_idx").on(t.status),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
