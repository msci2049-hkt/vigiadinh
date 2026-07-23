---
name: seed-data
description: Tạo seed script với data demo cho dev. Dùng khi user gõ "seed", "tạo data demo", "fake data".
---

# Seed script workflow

Mục đích: dev mới join hoặc reset DB → có data demo để test.

1. **Tạo `scripts/seed.ts`**:
   - Import `db` từ `@/db`
   - Import schemas cần thiết
   - Wrap trong `db.transaction` để all-or-nothing
   - Order: parent table trước (`brands`, `users`) → child table sau (`orders`)

2. **Data mẫu** (cho project shop đồng hồ):
   - 3 user: `admin@test.com`, `customer@test.com`, `staff@test.com` (password: `test12345`)
   - 5 brand: Rolex, Omega, Tudor, Seiko, Citizen
   - 4 category: Dress, Sport, Dive, Pilot
   - 20 watch: random kết hợp brand + category + giá
   - 3 order: 1 `pending`, 1 `paid`, 1 `shipped`

3. **Idempotent**:
   - Check tồn tại trước insert (`ON CONFLICT DO NOTHING`)
   - HOẶC clear table trước (CHỈ dev DB, check `NODE_ENV`):
     ```ts
     if (env.NODE_ENV === "production") throw new Error("seed bị cấm trên prod");
     ```

4. **Script `package.json`**:
   - `"db:seed": "bun scripts/seed.ts"`
   - `"db:reset": "bun run db:drop && bun run db:migrate && bun run db:seed"`

5. **Verify**:
   - Chạy: `bun run db:seed`
   - Login bằng `admin@test.com` / `test12345` → OK
   - `GET /api/products` → trả ≥ 20 sản phẩm

## Cấm

- ❌ Seed trên production (check `NODE_ENV` ngay đầu file).
- ❌ Password test trùng password thật của ai đó.
- ❌ Email test domain thật (dùng `@test.com` hoặc `@example.com`).
- ❌ Seed data với ID hardcode (dễ conflict) — dùng ULID generate.
