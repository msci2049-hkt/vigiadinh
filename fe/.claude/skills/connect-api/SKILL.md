---
name: connect-api
description: Thêm module API cho feature — queryOptions + key factory dùng apiClient (hoặc Hono rpc), hook useQuery/useMutation, xử lý lỗi qua ApiError.
---
# Kết nối API cho feature

## Khi nào dùng
Khi feature cần gọi BE. Mỗi feature có `api/<x>-api.ts` (key factory + `queryOptions`) và `hooks/use-<x>.ts`.

## Các bước
1. `api/<x>-api.ts`: định nghĩa key factory `const xKeys = { all: ['x'] as const, detail: (id) => [...xKeys.all, id] as const }`.
2. Khai báo `interface` response, rồi `xOptions()` trả `queryOptions({ queryKey, queryFn: () => apiClient.get<T>('/path') })`.
3. `hooks/use-<x>.ts`: `useQuery(xOptions())`. Mutation: `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: xKeys.all }) })`.
4. Xử lý lỗi: `apiClient` throw `ApiError` có `.status`. Phân nhánh theo `err instanceof ApiError && err.status === 404`.
5. `apiClient` đã set `credentials:'include'`, tự xử lý 401 (→ /login) và 503 (backoff theo `Retry-After`) — đừng tự retry tay.

## Ví dụ
```ts
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};
export function dashboardSummaryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: () => apiClient.get<DashboardSummary>("/api/dashboard/summary"),
  });
}
```

## Lưu ý / cạm bẫy
- `apiClient` vs `rpc`: mặc định dùng `apiClient` (`src/lib/api-client.ts`). `rpc` (`src/lib/rpc.ts`) chỉ là scaffold (AppType = Hono rỗng) — KHÔNG dùng cho tới khi cắm `AppType` của BE.
- Endpoint auth (đăng nhập…) → dùng `authClient`, KHÔNG dùng `apiClient`.
- Không hardcode URL: base lấy từ `env.VITE_API_URL` (apiClient lo sẵn). Dùng `import type` cho type-only import.

## Liên quan
skills/new-feature, skills/consume-sse; mẫu: `src/features/health/api/health-api.ts`, `src/features/dashboard/api/dashboard-api.ts`
