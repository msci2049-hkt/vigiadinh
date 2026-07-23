# SKILL: Tạo migration Drizzle

## Dùng khi nào

- Sau khi tạo/sửa bảng trong `src/db/schema/`.
- Sau khi thêm Better Auth plugin (đã chạy `auth:generate` trước).
- Backfill data (migration thủ công).
- **KHÔNG** dùng khi muốn drop column → cần workflow đặc biệt (xem mục Drop column).

---

## Thứ tự làm

```
1. Đảm bảo schema TS đã sửa xong.
2. bun run db:generate
   → drizzle-kit so sánh schema TS với DB, sinh SQL trong drizzle/.
3. ĐỌC file SQL vừa sinh. Kiểm tra:
   - Có DROP COLUMN/TABLE không? Nếu có → STOP, đọc mục Drop column.
   - Có RENAME không? drizzle-kit hỏi 'is X same as Y' → trả lời cẩn thận.
   - Có index/FK mới đúng như mong đợi không?
4. bun run db:migrate
   → Apply lên DB local.
5. Verify bằng bun run db:studio (mở browser).
6. Commit cả file schema TS lẫn file SQL migration.
7. Cập nhật .claude/CODE_BASE_MAP.md.
```

---

## File tạo ở đâu

- `drizzle/<timestamp>_<auto-name>.sql` (drizzle-kit sinh, **KHÔNG sửa tay**)
- `drizzle/meta/<timestamp>_snapshot.json` (drizzle-kit sinh, **KHÔNG sửa tay**)

---

## Lệnh hay dùng

```bash
# Sinh migration từ schema TS
bun run db:generate

# Sinh migration RIÊNG cho backfill (empty migration để viết SQL tay)
bunx drizzle-kit generate --custom --name backfill_user_status

# Apply migration
bun run db:migrate

# Mở Studio xem DB
bun run db:studio

# Drop entire DB local (dev only)
bun run db:drop
```

---

## Drop column — workflow chuẩn

Drop column = mất data, **không rollback được**. Đi 3 bước qua 3 release:

### Release 1 — Đánh dấu deprecated
```ts
// src/db/schema/users.ts
oldName: varchar("old_name", { length: 255 }), // @deprecated, sẽ xoá ở migration <future>
```
- Cập nhật code: KHÔNG ghi vào `oldName` nữa (chỉ đọc).
- Add column mới (nếu thay thế) + backfill.
- Deploy. Đợi >= 1 sprint.

### Release 2 — Xoá khỏi code TS
```ts
// Xoá field oldName khỏi schema.
// drizzle-kit sẽ sinh DROP COLUMN ở migration.
```
- ĐỌC kỹ migration SQL trước khi `db:migrate`.
- **Approval bằng tay** từ chủ project.
- Backup DB trước khi apply production.

### Release 3 — Verify
- Kiểm tra app không crash.
- Lưu giữ backup ít nhất 30 ngày.

---

## Backfill (migration thủ công)

Khi cần update data hàng loạt (vd: chuyển format cũ sang mới):

```bash
bunx drizzle-kit generate --custom --name backfill_payment_currency
```

Sinh file `drizzle/<timestamp>_backfill_payment_currency.sql` TRỐNG. Tự viết SQL:

```sql
-- Backfill: payment với currency NULL → 'VND'.
-- Idempotent: chạy lần 2 không sai.
UPDATE payments
SET currency = 'VND'
WHERE currency IS NULL;
```

**Quy tắc backfill:**
- SQL phải idempotent (chạy nhiều lần không sai).
- Bảng lớn (> 100k row) → chia batch:
  ```sql
  UPDATE payments SET currency = 'VND'
  WHERE id IN (SELECT id FROM payments WHERE currency IS NULL LIMIT 1000);
  ```
  Lặp đến khi `rowcount = 0`.
- Test trên staging trước.

---

## RENAME column / table

drizzle-kit không tự detect rename, sẽ hỏi:
```
Is column 'fullName' a renamed of 'name'?
```

- Trả lời **CÓ** → migration sinh `ALTER TABLE ... RENAME COLUMN`. Giữ data.
- Trả lời **KHÔNG** → drizzle-kit sinh `DROP + ADD`. **MẤT DATA**.

→ Đọc câu hỏi cẩn thận trước khi Enter.

---

## Migration cho Better Auth

```bash
# 1. Sau khi sửa src/lib/auth.ts (thêm plugin)
bun run auth:generate
# → Cập nhật src/db/schema/auth.ts

# 2. Sinh migration Drizzle bình thường
bun run db:generate
bun run db:migrate
```

**Lưu ý:** `src/db/schema/auth.ts` do Better Auth CLI sinh. KHÔNG sửa tay — chạy lại CLI nếu cần.

---

## Migration trên Production

```bash
# Trong CI/CD, KHÔNG dùng db:generate (đó là dev).
# Chỉ apply những migration đã commit:
bun run db:migrate

# Hoặc dùng drizzle-kit migrate (cùng lệnh)
bunx drizzle-kit migrate
```

**Quy tắc deploy:**
1. Migration phải backward-compatible với code cũ (nếu rolling deploy).
2. Add column → deploy code mới → drop column (nếu cần) là 3 release riêng.
3. Index lớn → `CREATE INDEX CONCURRENTLY` (tránh lock table).

---

## Checklist cuối

- [ ] Đã ĐỌC file SQL trong `drizzle/<timestamp>_*.sql`.
- [ ] Không có `DROP COLUMN/TABLE` ngoài ý muốn.
- [ ] Câu hỏi rename của drizzle-kit đã trả lời chính xác.
- [ ] Migration apply local thành công.
- [ ] `bun run db:studio` xác nhận DB đúng schema.
- [ ] File SQL được commit (không add vào `.gitignore`).
- [ ] Backfill SQL idempotent + test trên staging.
- [ ] Cập nhật `.claude/CODE_BASE_MAP.md` nếu có bảng mới.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `relation "X" already exists` | DB có sẵn nhưng meta snapshot không match | Drop DB local + chạy lại migrate, hoặc đồng bộ snapshot. |
| `cannot drop column ... contains data` | Có FK trỏ vào | Drop FK trước, hoặc dùng `CASCADE`. |
| Migration apply staging OK, production fail | Production có constraint khác | `EXPLAIN` migration trên production-clone trước. |
| Drizzle hỏi rename nhưng nhầm 2 column khác nhau | Đặt tên giống | Trả lời **KHÔNG**, xoá migration sai, sửa tên schema, generate lại. |
| `bun run db:migrate` báo "no migrations to apply" | File SQL không có trong `drizzle/` | Kiểm tra commit, đảm bảo file SQL được tracking. |
| Sinh migration cho better-auth không có | Quên chạy `auth:generate` trước | Chạy `bun run auth:generate` rồi mới `db:generate`. |
| Schema TS sửa rồi mà generate báo "no changes" | Chưa re-export trong `index.ts` | Thêm `export * from "./X";`. |
