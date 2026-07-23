---
name: protect-route
description: Bảo vệ một route bằng beforeLoad kiểm tra session (Better Auth) và redirect về /login kèm search param redirect.
---
# Bảo vệ route (auth guard)

## Khi nào dùng
Khi một trang chỉ cho người đã đăng nhập. Session là COOKIE (Better Auth) — không có token để đọc; phải hỏi BE qua `getSession()`.

## Các bước
1. Trong file route, thêm `beforeLoad` async, gọi `authClient.getSession()` (bọc `.catch` để khi BE lỗi → coi như chưa đăng nhập).
2. Nếu không có `data` → `throw redirect({ to: '/login', search: { redirect: location.href } })`.
3. `redirect` import từ `@tanstack/react-router`; `authClient` từ `@/lib/auth-client`.
4. Trang `/login` đọc `redirect` qua `Route.useSearch()` rồi điều hướng lại sau khi đăng nhập (xem `src/app/routes/login.tsx`).
5. Trong component dùng `useCurrentUser()` để lấy user reactively.

## Ví dụ
```tsx
// src/app/routes/dashboard.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession().catch(() => ({ data: null }));
    if (!data) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: DashboardPage,
});
```

## Lưu ý / cạm bẫy
- Cookie-cache revocation window: logout/đổi role có thể trễ tới hết session TTL. Với HÀNH ĐỘNG NHẠY CẢM, re-check session ngay lúc thao tác, đừng tin cache.
- Đừng tự lưu/đọc token — không có. Luôn `credentials:'include'` (đã set sẵn trong client).
- `apiClient` gặp 401 cũng tự đá về `/login` qua `setUnauthorizedHandler` (wired ở `src/app/provider.tsx`).

## Liên quan
[rules/auth.md], skills/new-route; mẫu: `src/app/routes/dashboard.tsx`, `src/features/auth/hooks/use-current-user.ts`
