// WHY: DB query shared giữa các feature trong module. Mỗi feature handler
// import từ đây thay vì viết SQL lặp lại. KHÔNG đụng req/res — pure data layer.
// Throw domain string (PRODUCT_NOT_FOUND) — global onError map → 404.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { PRODUCT_ERRORS } from "../domain/errors";
import { type NewProduct, type Product, products } from "./products.schema";

const LIST_LIMIT = 50;

export async function listActive(limit = LIST_LIMIT): Promise<Product[]> {
  return db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.createdAt))
    .limit(limit);
}

export async function findActiveById(id: string): Promise<Product | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.status, "active")))
    .limit(1);
  return row ?? null;
}

export async function insert(data: NewProduct): Promise<Product> {
  const [row] = await db.insert(products).values(data).returning();
  if (!row) throw new Error(PRODUCT_ERRORS.CREATE_FAILED);
  return row;
}

export async function update(id: string, data: Partial<NewProduct>): Promise<Product> {
  const [row] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!row) throw new Error(PRODUCT_ERRORS.NOT_FOUND);
  return row;
}

export async function remove(id: string): Promise<void> {
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (!row) throw new Error(PRODUCT_ERRORS.NOT_FOUND);
}
