---
name: new-feature
description: Tạo mới một feature trong src/features/<x>/ (api, hooks, components, schemas) và cắm vào route ở tầng app, đúng kiến trúc Bulletproof React.
---
# Tạo feature mới

## Khi nào dùng
Khi thêm một mảng chức năng độc lập (vd: `orders`, `users`). Mỗi feature TỰ CHỨA, không import feature khác.

## Các bước
1. Tạo cây thư mục: `src/features/<x>/{api,components,hooks,schemas,types}` (chỉ tạo phần cần).
2. `api/<x>-api.ts`: key factory + `queryOptions()` dùng `apiClient` (xem skill `connect-api`).
3. `hooks/use-<x>.ts`: bọc `useQuery(<x>Options())` / `useMutation`.
4. `schemas/<x>-schema.ts`: Zod v4 cho input/response (dùng `import type` cho type suy ra).
5. `components/<x>-card.tsx`: UI thuần, đọc data qua hook của feature.
6. Cắm vào tuyến đường: tạo/sửa file trong `src/app/routes/` (xem `new-route`). Compose feature Ở TẦNG APP.
7. Viết 1 test (`*.test.ts(x)`) cạnh file — mẫu ở `src/features/health/components/health-badge.test.tsx`.
8. Chạy kiểm tra: `pnpm validate` PHẢI exit 0 (typecheck + biome + boundaries).

## Ví dụ
```ts
// src/features/orders/api/orders-api.ts
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
export const orderKeys = { all: ["orders"] as const };
export interface Order { id: string; total: number }
export function ordersOptions() {
  return queryOptions({ queryKey: orderKeys.all, queryFn: () => apiClient.get<Order[]>("/api/orders") });
}
```

## Lưu ý / cạm bẫy
- CẤM cross-feature import: feature A không import `@/features/B/*` (script `scripts/check-boundaries.ts` chặn).
- Feature KHÔNG import `@/app/*` (chiều phụ thuộc một hướng).
- File ≤ 300 dòng, component ≤ 200 dòng. Không barrel lớn. Không `any`/`@ts-ignore`.
- Server state → TanStack Query (api/). UI state global → Zustand (`add-store`). Đừng nhét server state vào store.

## Liên quan
[rules/module-boundary.md], skills/new-route, skills/connect-api, skills/add-store; mẫu: `src/features/dashboard/`
