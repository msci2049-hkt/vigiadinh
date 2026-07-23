# SKILL: Thêm route vào module có sẵn

## Dùng khi nào

- Thêm endpoint mới (GET/POST/PATCH/DELETE) vào module đã tồn tại.
- Câu lệnh người dùng dạng: *"thêm API X vào module Y"*, *"tạo endpoint Z"*, *"cần route cancel payment"*.
- **KHÔNG** dùng skill này khi tạo module mới hoàn toàn → dùng `new-module` thay thế.

---

## Thứ tự làm

```
1. Đọc .claude/CODE_BASE_MAP.md
   → Xác định module đích đã có những file gì.

2. Đọc src/modules/<module>/routes.ts
   → Xem các route hiện có để không trùng path.

3. Đọc src/modules/<module>/service.ts
   → Service đã có hàm cần dùng chưa? Chưa thì thêm.

4. Thêm hoặc cập nhật DTO trong src/modules/<module>/dto.ts
   → Validate input mới bằng Zod.

5. Thêm hàm service trong src/modules/<module>/service.ts
   → Logic nghiệp vụ ở đây.

6. Thêm route handler trong src/modules/<module>/routes.ts
   → Chỉ validate + gọi service + format response.

7. Curl test endpoint mới.

8. Scan file > 300 dòng. Tách nếu có.

9. Cập nhật .claude/CODE_BASE_MAP.md (cột "Cập nhật").

10. Báo xong + liệt kê file đã sửa.
```

---

## File chỉnh sửa

```
src/modules/<module>/
├── dto.ts        ← thêm Zod schema mới
├── service.ts    ← thêm hàm logic
└── routes.ts     ← thêm route handler
```

KHÔNG cần sửa `src/index.ts` (vì module đã mount sẵn).

---

## Code mẫu

Giả sử module `payment` đã tồn tại, giờ thêm route `PATCH /api/payments/:id/cancel`.

### 1. Thêm DTO — `src/modules/payment/dto.ts`

```ts
// ...các DTO cũ giữ nguyên...

/**
 * cancelPaymentDto — body khi huỷ payment.
 * - reason: lý do huỷ, bắt buộc cho audit.
 */
export const cancelPaymentDto = z.object({
  reason: z.string().min(1).max(500),
})

export type CancelPaymentInput = z.infer<typeof cancelPaymentDto>
```

### 2. Thêm service — `src/modules/payment/service.ts`

```ts
// ...các hàm cũ giữ nguyên...

/**
 * Huỷ payment.
 * - Chỉ huỷ được khi status === 'pending'. Đã 'success'/'failed' thì throw.
 * - Lý do: payment đã success không thể huỷ ở DB, phải đi qua flow refund.
 */
export async function cancelPayment(
  id: string,
  userId: string,
  input: CancelPaymentInput
): Promise<Payment> {
  const existing = await getPaymentById(id)
  if (!existing) throw new Error('PAYMENT_NOT_FOUND')
  if (existing.userId !== userId) throw new Error('FORBIDDEN')
  if (existing.status !== 'pending') throw new Error('PAYMENT_NOT_CANCELLABLE')

  const [updated] = await db
    .update(payments)
    .set({
      status: 'failed',
      // Lưu reason ở column metadata nếu có, hoặc bảng audit riêng.
      updatedAt: new Date(),
    })
    .where(eq(payments.id, id))
    .returning()
  return updated
}
```

### 3. Thêm route — `src/modules/payment/routes.ts`

> **Validator wrapper bắt buộc**: dùng `zv` từ `@/middlewares/validator`, **KHÔNG** dùng `zValidator` từ `@hono/zod-validator` trực tiếp — `zValidator` short-circuit response với shape khác chuẩn, bypass global `onError`. Xem `.claude/ERRORS.md` BUG-001.

```ts
import { zv } from '@/middlewares/validator'
import { cancelPaymentDto, paymentIdParam } from './dto'

// ...các route cũ giữ nguyên...

paymentRoutes.patch(
  '/:id/cancel',
  zv('param', paymentIdParam),
  zv('json', cancelPaymentDto),
  async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    try {
      const payment = await paymentService.cancelPayment(id, userId, input)
      return c.json({ data: payment })
    } catch (err) {
      // Map domain error → HTTP status. KHÔNG để service biết HTTP status.
      const msg = (err as Error).message
      if (msg === 'PAYMENT_NOT_FOUND') return c.json({ error: 'Not found' }, 404)
      if (msg === 'FORBIDDEN') return c.json({ error: 'Forbidden' }, 403)
      if (msg === 'PAYMENT_NOT_CANCELLABLE') return c.json({ error: msg }, 409)
      throw err // unknown → để error handler chung xử lý
    }
  }
)
```

---

## Pattern bắt buộc

### Route handler chỉ làm 3 việc

```ts
async (c) => {
  // 1. Lấy data đã validate
  const input = c.req.valid('json')
  const userId = c.get('userId')

  // 2. Gọi service
  const result = await service.someAction(userId, input)

  // 3. Format response
  return c.json({ data: result })
}
```

Nếu route handler dài hơn 15 dòng → logic đang lọt vào route. **Đẩy về service.**

### Validation order

```ts
.method(
  '/path/:param',
  zv('param', paramSchema),   // ← param TRƯỚC
  zv('query', querySchema),   // ← query
  zv('json', bodySchema),     // ← body CUỐI
  handler
)
```

### HTTP status code chuẩn

| Tình huống | Status |
|---|---|
| GET thành công | 200 |
| POST tạo mới thành công | 201 |
| DELETE thành công, không có body trả về | 204 |
| Validation sai (Zod) | 400 (Hono auto trả) |
| Chưa auth | 401 |
| Đã auth nhưng không có quyền | 403 |
| Resource không tồn tại | 404 |
| Conflict (vd: đã tồn tại, không thể chuyển trạng thái) | 409 |
| Lỗi server | 500 |

---

## Curl test (BẮT BUỘC cho mọi endpoint mới)

```bash
# 1. Không auth → 401
curl -i -X PATCH http://localhost:3000/api/payments/abc/cancel

# 2. Auth nhưng id sai format → 400
curl -i -X PATCH http://localhost:3000/api/payments/not-uuid/cancel \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "test"}'

# 3. Payment không tồn tại → 404
curl -i -X PATCH http://localhost:3000/api/payments/00000000-0000-0000-0000-000000000000/cancel \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "test"}'

# 4. Của người khác → 403
# 5. Đã success rồi → 409
# 6. Happy path → 200
```

---

## Checklist cuối

- [ ] Đã thêm DTO Zod nếu có input mới.
- [ ] Đã thêm hàm service (logic ở service, KHÔNG ở route).
- [ ] Route handler ≤ 15 dòng, chỉ validate + gọi service + format.
- [ ] Đã map domain error → HTTP status đúng (404/403/409...).
- [ ] Curl test đủ 6 case: no-auth → 401, bad-input → 400, not-found → 404, forbidden → 403, conflict → 409, happy path → 2xx.
- [ ] File `routes.ts`, `service.ts`, `dto.ts` đều ≤ 300 dòng. Đã chạy lệnh scan.
- [ ] Có comment giải thích cho logic không hiển nhiên (vd: tại sao không cho huỷ khi success).
- [ ] Đã cập nhật `.claude/CODE_BASE_MAP.md` (cột "Cập nhật").
- [ ] Không `import` từ module khác.
- [ ] Không có `any`.

---

## Lỗi hay gặp khi thêm route

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Curl trả **404** thay vì 401 | Quên mount `app.route(...)` hoặc tên path sai | Check `src/index.ts` |
| Validation không chạy | Quên `zv` hoặc đặt sai thứ tự | `param` → `query` → `json` |
| `c.req.valid('json')` báo type lỗi | Quên đăng ký `zv` cho `'json'` | Thêm `zv('json', schema)` |
| Validation error shape lệch (`{success:false,...}`) | Dùng `zValidator` trực tiếp từ `@hono/zod-validator` thay vì wrapper `zv` | Đổi `zValidator` → `zv` (BUG-001). |
| Service throw nhưng trả 500 thay vì 4xx | Quên try/catch + map error | Map domain error → HTTP status trong route |
| Hono không tìm thấy middleware `c.get('userId')` | Quên `paymentRoutes.use('*', authMiddleware)` | Thêm middleware ở đầu file routes |
