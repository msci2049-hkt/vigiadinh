---
appliesTo: "src/lib/auth-client.ts, src/features/auth/**, src/app/routes/** (guards)"
---

# Rule: Auth (Better Auth client)

**Mô hình:** session **cookie** qua Better Auth. FE KHÔNG tự quản token, KHÔNG JWT Bearer,
KHÔNG silent-refresh. Mọi request kèm `credentials:'include'`.

## DO
- Dùng `@/lib/auth-client`: `useSession()` (reactive), `signIn.email()`, `signUp.email()`,
  `signOut()`, `getSession()` (async, authoritative).
- Feature code dùng hook bọc `@/features/auth/hooks/use-current-user` thay vì gọi thẳng client.
- **Route bảo vệ — guard 2 tầng** (idiom THẬT của code, KHÔNG gọi `authClient.getSession()`
  trực tiếp trong `beforeLoad`):
  1. Tầng session — `apps/web/src/app/routes/_authenticated/route.tsx`: fetch session MỘT lần
     qua TanStack Query rồi đưa vào router context (con đọc `context.session`, không gọi mạng lại):
     ```ts
     beforeLoad: async ({ context, location }) => {
       const session = await context.queryClient.ensureQueryData(sessionQueryOptions(authClient));
       if (!session?.user) {
         throw redirect({ to: "/login", search: { redirect: location.href } });
       }
       return { session };
     }
     ```
  2. Tầng role — `apps/web/src/app/routes/_authenticated/_admin/route.tsx`: dùng guard
     `requireRoles([...])` từ `@repo/auth` (`packages/auth/src/guards.ts` — đọc
     `context.session.user.role`, sai role → `/unauthorized?redirect=&reason=insufficient_role`):
     ```ts
     export const Route = createFileRoute("/_authenticated/_admin")({
       beforeLoad: requireRoles(["admin"]),
       component: AdminPanel,
     });
     ```
  ⚠️ Route guard là UX, KHÔNG phải security — BE re-check mọi API call.
- `baseURL` = **gốc BE** (`env.VITE_API_URL`); Better Auth tự thêm `/api/auth`.

## DON'T
- Đừng lưu token vào localStorage / header thủ công.
- Đừng tin session là tức thời: **cookie-cache revocation window** — logout/đổi quyền có thể
  trễ tới TTL. Với hành động nhạy cảm (đổi quyền, xóa, thanh toán) → `getSession()` lại trước khi làm.
- **Đừng gửi `role` (hay field nhạy cảm) khi `signUp.email()`** — server SỞ HỮU role. Form
  sign-up (nếu có) CHỈ tạo user thường, KHÔNG render option chọn `admin`/`staff`. Cần phân loại
  public (vd `seller`) thì chỉ role nằm trong whitelist public của BE. BE đã chặn cứng
  (`400 FIELD_NOT_ALLOWED` + databaseHooks) nhưng FE cũng KHÔNG được cố gửi.

## Role = server sở hữu (BẤT BIẾN, mirror BE)

Tự-phong-role qua sign-up = privilege escalation. BE template chặn 3 lớp
(`mau-demo-be/.claude/rules/auth.md` §"Role = server sở hữu"). FE tuân theo:

- `authClient.signUp.email({...})` KHÔNG kèm `role`. Grep phải trả **0** `role` trong payload signUp.
- Nâng/hạ quyền CHỈ qua `authClient.admin.*` (setRole, createUser) — cần session admin, BE enforce.
- Thêm role mới (mirror BE `access-control.ts` + `PANELS`) — xem `docs/ADD-NEW-PANEL.md`.

## Cạm bẫy
- Chưa auth, BE trả **401** (không phải 404) → `@/lib/api-client` tự đá `/login`.
- BE phải bật CORS allow-credentials + `trustedOrigins` = URL FE, nếu không cookie không gửi được.

Liên quan: `rules/routing.md`, `rules/data-fetching.md`, `skills/protect-route`.
