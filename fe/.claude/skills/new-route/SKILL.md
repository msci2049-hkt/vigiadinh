---
name: new-route
description: Thêm một tuyến đường file-based mới trong src/app/routes/ (createFileRoute), validateSearch bằng Zod nếu cần, và thêm link vào nav.
---
# Thêm route mới

## Khi nào dùng
Khi cần một trang/URL mới. TanStack Router là FILE-BASED: 1 file = 1 route. Cây route `src/app/routeTree.gen.ts` được sinh tự động — KHÔNG sửa tay.

## Các bước
1. Tạo file trong `src/app/routes/`, vd `settings.tsx` → path `/settings` (lồng: `settings.profile.tsx`).
2. Export `Route = createFileRoute('/path')({ component: X })`.
3. (Tuỳ chọn) Search params: thêm `validateSearch: <zodSchema>` — Zod v4 dùng TRỰC TIẾP (Standard Schema, KHÔNG cần adapter). Đọc bằng `Route.useSearch()`.
4. (Tuỳ chọn) Prefetch data: `loader: ({ context }) => context.queryClient.ensureQueryData(xxxOptions())`.
5. Thêm link điều hướng vào `src/config/site.ts` (mảng `nav`).
6. Để Vite/`tsr generate` sinh lại cây route (chạy khi `pnpm dev`/`build`); KHÔNG sửa `routeTree.gen.ts`.

## Ví dụ
```tsx
// src/app/routes/settings.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
const search = z.object({ tab: z.enum(["profile", "billing"]).default("profile") });
export const Route = createFileRoute("/settings")({
  validateSearch: search,
  component: () => <div>Tab: {Route.useSearch().tab}</div>,
});
```

## Lưu ý / cạm bẫy
- Plugin `tanstackRouter` PHẢI đứng TRƯỚC `react()` trong `vite.config.ts` (đã cấu hình sẵn).
- Cần bảo vệ route → dùng skill `protect-route` (`beforeLoad`).
- Dùng `Link`/`navigate` từ `@tanstack/react-router`, type-safe theo cây route.

## Liên quan
skills/protect-route, skills/connect-api; mẫu: `src/app/routes/login.tsx` (validateSearch), `src/app/routes/dashboard.tsx`
