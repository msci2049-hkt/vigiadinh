---
name: consume-sse
description: Nhận sự kiện realtime qua useServerEvents — xử lý onEvent, và onReconnect thì invalidateQueries (refetch-bù vì SSE at-most-once).
---
# Nhận sự kiện SSE

## Khi nào dùng
Khi cần realtime từ BE (kênh `sse:user:{id}`). Dùng hook `useServerEvents` ở `src/lib/sse.ts` (chạy trên `@microsoft/fetch-event-source`: gửi cookie, tự theo dõi `Last-Event-ID`, tự retry).

## Các bước
1. Gọi `useServerEvents({ onEvent, onReconnect, onError })` trong component (mặc định `path:'/api/events'`, `enabled:true`).
2. `onEvent(event)`: cập nhật UI cục bộ; `event` có `{ id?, event, data }` (data là string).
3. `onReconnect`: gọi `queryClient.invalidateQueries({ queryKey: xKeys.all })` — REFETCH-BÙ. SSE là at-most-once: event mất lúc rớt mạng sẽ KHÔNG được gửi lại.
4. (Tuỳ chọn) `enabled: isAuthenticated` để tạm dừng khi chưa đăng nhập.
5. `onError`: set trạng thái lỗi cho UI; hook tự retry (không cần tự reconnect).

## Ví dụ
```tsx
// theo src/features/dashboard/components/events-feed.tsx
const queryClient = useQueryClient();
useServerEvents({
  onEvent: (event) => setItems((prev) => [event, ...prev].slice(0, 50)),
  onReconnect: () => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  onError: () => setStatus("error"),
});
```

## Lưu ý / cạm bẫy
- BẮT BUỘC refetch-bù trong `onReconnect`, đừng chỉ dựa vào stream để đồng bộ state.
- Đừng dùng `EventSource` thuần (không gửi cookie). Dùng đúng hook đã có.
- Endpoint mặc định `/api/events`; đổi qua `path`. Base URL từ `env.VITE_API_URL` (hook lo sẵn).
- 401 khi mở stream → hook tự dừng (không loop). Cần đăng nhập trước.

## Liên quan
skills/connect-api; nguồn: `src/lib/sse.ts`; mẫu: `src/features/dashboard/components/events-feed.tsx`
