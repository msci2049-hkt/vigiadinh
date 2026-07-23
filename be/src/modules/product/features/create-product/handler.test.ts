// WHY: Smoke test cho repo dùng bởi create-product — chạy trên Postgres THẬT
// (`docker compose up -d postgres`). DB không sẵn → SKIP nêu lý do, KHÔNG fail
// mù (đồng nhất pattern test-support/pg — trước đây 4 test này fail-env trên máy
// không có Docker, gây nhiễu baseline).
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import * as repo from "../../infra/product.repository";
import { products } from "../../infra/products.schema";

const reachable = await pgReachable();
if (!reachable) console.warn(`${SKIP_REASON} (create-product.handler)`);
const suite = reachable ? describe : describe.skip;

suite("create-product handler", () => {
  beforeEach(async () => {
    await db.delete(products);
  });

  afterAll(async () => {
    await db.delete(products);
  });

  test("repo.insert happy path", async () => {
    const row = await repo.insert({
      name: "Test Watch",
      price: 10_000,
      stock: 5,
      status: "active",
    });
    expect(row.id).toHaveLength(26);
    expect(row.name).toBe("Test Watch");
    expect(row.price).toBe(10_000);
  });

  test("repo.findActiveById trả null khi không tồn tại", async () => {
    const r = await repo.findActiveById("00000000000000000000000000");
    expect(r).toBeNull();
  });

  test("repo.update throw PRODUCT_NOT_FOUND khi id sai", async () => {
    await expect(repo.update("00000000000000000000000000", { name: "X" })).rejects.toThrow(
      "PRODUCT_NOT_FOUND",
    );
  });
});
