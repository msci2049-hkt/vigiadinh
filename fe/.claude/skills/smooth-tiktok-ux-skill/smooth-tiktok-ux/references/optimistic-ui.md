# Optimistic UI — bấm là thấy ngay (code đã chạy production)

Đây là lớp biến "web nhanh" thành "cảm giác native". Áp SAU khi smooth-nav ổn.

## ⛔ LẰN RANH CỨNG trước tiên

Optimistic = hiện kết quả TRƯỚC khi server xác nhận. An toàn với thứ **đảo được, hậu quả thấp**.

- ✅ **ELIGIBLE:** like, follow, bookmark, react, comment, add-to-cart (badge/list, KHÔNG phải total tiền), mark-notification-read, join/leave, typing.
- ⛔ **FORBIDDEN:** wallet/balance, order/checkout, thanh toán, withdraw, carbon credit, mọi mutation `bigint` tiền, ghi blockchain/PoF, bất kỳ thứ không đảo được. → giữ pessimistic (chờ server).
- ⚠️ Phân vân → để pessimistic, hỏi user. Không đoán.

Luôn scan phân loại TOÀN BỘ mutation thành 3 nhóm này trước khi code. Grep chứng minh 0 `onMutate/setQueryData` chạm query tiền là gate bắt buộc.

## Helper 1 — Toggle + count (like/follow/bookmark/mark-read)

Shape phổ biến nhất: đảo boolean + chỉnh số đếm.

```ts
// packages/core/src/optimistic/use-optimistic-toggle.ts
export function useOptimisticToggle({ queryKey, mutationFn, applyOptimistic }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey })         // BẮT BUỘC: chặn refetch clobber optimistic/rollback
      const prev = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, (old) => applyOptimistic(old, vars))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev)  // rollback chính xác
    },
    onSettled: () => {
      // chỉ invalidate khi KHÔNG còn mutation cùng key đang bay → tránh flicker/rollback-war khi tap nhanh
      if (qc.isMutating({ mutationKey: queryKey }) <= 1) qc.invalidateQueries({ queryKey })
    },
  })
}
```

Bẫy tap nhanh (like 10×/giây): `cancelQueries` + guard `isMutating` xử lý. Quyết state theo `vars` (boolean đích), đừng +1/−1 mù → tránh drift. Spam thật thì debounce network gộp toggle cuối.

## Helper 2 — Append list + temp id (comment/message)

Thêm item với temp id, reconcile khi server trả id thật:

```ts
// packages/core/src/optimistic/use-optimistic-append.ts (ý tưởng)
const clientKey = crypto.randomUUID()
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey })
  const prev = qc.getQueryData(queryKey)
  const temp = { ...vars, id: `temp-${clientKey}`, clientKey, status: 'sending' }
  qc.setQueryData(queryKey, (old) => appendToInfinite(old, temp))
  return { prev, clientKey }
}
onError: (_e,_v,ctx) => removeByClientKey(qc, queryKey, ctx.clientKey)   // gỡ temp
onSuccess: (real, _v, ctx) => swapTempWithReal(qc, queryKey, ctx.clientKey, real)  // SWAP không append mới
```

- Comment: bubble mờ "đang gửi" → nét khi xong. Fail → biến mất + toast.
- Add-to-cart: thêm vào list giỏ + badge +1 NGAY. KHÔNG optimistic total tiền (chỉ "đã thêm").

## Ca khó nhất — Chat gửi tin + DEDUPE SSE

Tin đến từ **2 nguồn**: optimistic local + SSE echo/refetch → double nếu không dedupe.

1. Gửi: append temp `{ id:'temp-uuid', clientMsgId: uuid, status:'sending' }` NGAY.
2. **BE:** nhận `clientMsgId`, lưu kèm, TRẢ LẠI trong message thật (cả HTTP response lẫn SSE broadcast). Idempotency: cùng `clientMsgId` = không insert lần hai.
3. **Reconcile:** khi nhận message thật (response HOẶC SSE), nếu tồn tại temp có `clientMsgId` khớp → **REPLACE** (swap id, status='sent'), KHÔNG append. Không khớp → append (tin người khác).
4. Fail: `status:'failed'` + nút retry. KHÔNG biến mất im lặng — chat mất tin là tối kỵ.

Test bắt buộc: 2 client thật gửi qua lại → mỗi tin CHỈ 1 bubble; mạng chậm → 'sending'→'sent' đúng; 5 tin liên tiếp → không trùng, đúng thứ tự.

## Tương tác với persist

Item optimistic temp (chưa settle) có thể bị đóng băng vào localStorage nếu đóng app giữa chừng. Trong `shouldDehydrateQuery`: loại query đang có item `id` bắt đầu `temp-`, hoặc chỉ persist khi không có mutation cùng key pending.

## Tác dụng (giải thích cho user)

Bấm like → tim đỏ tức thì. Gửi chat → bong bóng hiện ngay như iMessage/Zalo. Comment → hiện liền dạng "đang gửi". Thêm giỏ → badge +1 ngay. App HẾT cảm giác "đang tải" — trừ chỗ tiền vẫn chờ server thật (cố ý, vì an toàn).
