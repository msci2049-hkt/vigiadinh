---
appliesTo: "src/app/routes/**, src/app/router.tsx, vite.config.ts (router plugin)"
---

# Rule: Routing (TanStack Router, file-based)

## Cấu trúc
- Route = **file** trong `src/app/routes/`. Cây route `src/app/routeTree.gen.ts` **tự sinh**
  (`tsr generate` / vite) — **gitignored, KHÔNG sửa tay**.
- Plugin `tanstackRouter` (từ `@tanstack/router-plugin/vite`) phải đứng **trước** `react()`.
- Router + context (`{ queryClient }`) ở `src/app/router.tsx`. Root layout ở `routes/__root.tsx`
  (`createRootRouteWithContext<RouterContext>()`).

## DO
- Tạo route: `export const Route = createFileRoute("/path")({ component, ... })`.
- **Search params validate bằng Zod** (Zod v4 = Standard Schema → truyền thẳng, KHÔNG cần adapter):
  ```ts
  validateSearch: z.object({ page: z.number().int().min(1).catch(1) }),
  // đọc: const { page } = Route.useSearch();
  ```
- Bảo vệ route bằng `beforeLoad` + `throw redirect({ to, search })` (xem `rules/auth.md`).
- Data cho route qua `loader: ({ context }) => context.queryClient.ensureQueryData(...)`.
- Link `<Link to="/x">` (type-safe). Nav tập trung ở `src/config/site.ts`.

## DON'T
- Đừng sửa `routeTree.gen.ts`. Đừng đặt route ngoài `src/app/routes/`.
- Đừng đọc search param thô — luôn qua `validateSearch` (Zod).
- Đừng để route component chứa logic nặng → tách vào `features/`.

Liên quan: `skills/new-route`, `skills/protect-route`, `rules/auth.md`.
