---
name: new-test
description: Viết unit test cho service mới dùng bun test. Dùng khi user gõ "viết test", "thêm test cho", "test module".
---

# Test workflow với `bun test`

## Convention

- Test file: `<name>.test.ts`, đặt CÙNG folder file gốc
- Vd: `src/modules/product/service.ts` → `src/modules/product/service.test.ts`
- Dùng `bun test` (built-in, không cần Jest/Vitest)

## Pattern cơ bản

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createProduct, getActiveProductById } from "./service";
import { db } from "@/db";
import { products } from "@/db/schema";

describe("product service", () => {
  beforeEach(async () => {
    // Clean DB hoặc setup test data
    await db.delete(products);
  });

  test("createProduct happy path", async () => {
    const product = await createProduct({
      name: "Test Product",
      price: 10000,
      stock: 5,
      status: "active",
    });
    expect(product.id).toBeDefined();
    expect(product.name).toBe("Test Product");
  });

  test("getActiveProductById trả null khi không tồn tại", async () => {
    const r = await getActiveProductById("00000000000000000000000000");
    expect(r).toBeNull();
  });
});
```

## Quy tắc

- 1 file test/1 service file
- Test service logic, **KHÔNG** test routes (curl test cho routes)
- Mock external API (Stripe, Resend) qua `mock()` của bun
- Database test: dùng schema test riêng HOẶC transaction rollback
- Coverage target: **70%+** cho `service`, 0% cho routes (đã có curl test)

## Scripts

`package.json` phải có:

- `"test": "bun test"`
- `"test:watch": "bun test --watch"`
- `"test:coverage": "bun test --coverage"`

## Khi test cần DB

- Dev/CI: chạy `docker compose up -d postgres` trước khi `bun test`
- Hoặc dùng `testcontainers` (cài khi cần: `bun add -d testcontainers`) để spawn Postgres ephemeral
