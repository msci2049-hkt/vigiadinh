---
appliesTo: "src/features/**/api/**, src/features/**/hooks/**, src/lib/api-client.ts, src/lib/query-client.ts"
---

# Rule: Data fetching (TanStack Query v5 + apiClient)

## Query keys + options
- Mỗi feature có **key factory** + `queryOptions()` trong `<feature>/api/*.ts`:
  ```ts
  export const xKeys = { all: ["x"] as const, detail: (id: string) => [...xKeys.all, id] as const };
  export const xOptions = (id: string) => queryOptions({
    queryKey: xKeys.detail(id),
    queryFn: () => apiClient.get<X>(`/api/x/${id}`),
  });
  ```
- Component/hook dùng `useQuery(xOptions(id))`; route loader dùng
  `context.queryClient.ensureQueryData(xOptions(id))`.

## HTTP
- Gọi BE qua `@/lib/api-client` (`apiClient.get/post/...`) — luôn `credentials:'include'`.
  Lỗi ném `ApiError` (có `.status`, `.retryAfterMs`).
- **401** → tự đá `/login`. **503** → backoff theo `Retry-After` (đã xử lý trong client).
- Defaults ở `@/lib/query-client`: `staleTime 60s`, không retry lỗi 4xx, không refetch on focus.

## DON'T
- Đừng tạo **vòng lặp refetch**: không đặt object/array mới làm `queryKey` mỗi render; không gọi
  `invalidateQueries` trong render. Invalidate trong event handler / `onReconnect` / mutation `onSuccess`.
- Đừng đặt server-state vào Zustand. Server data = Query; Zustand chỉ cho **global UI state**.
- Đừng `fetch()` trực tiếp trong component — qua `apiClient` (hoặc `@/lib/rpc`).

Liên quan: `rules/auth.md`, `skills/connect-api`, `skills/consume-sse`.
