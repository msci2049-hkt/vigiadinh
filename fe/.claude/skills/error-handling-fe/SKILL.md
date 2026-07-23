---
name: error-handling-fe
description: Xử lý lỗi ở FE này đúng lớp và FAIL-CLOSED. Lỗi API đã bọc thành ApiError (.status/.retryAfterMs); 401→/login và 503→backoff đã tự xử trong apiClient; Query retry-policy đã set; SSE fatal 401/403 → session expired. Skill quyết định: đặt error boundary ở đâu (route errorComponent + Sentry), toast vs inline, khi nào refetch-bù sau SSE reconnect, và nguyên tắc fail-closed (lỗi kiểm quyền = coi như KHÔNG có quyền). Dùng khi user gõ "xử lý lỗi FE", "error boundary", "hiện lỗi API", "401 đá login", "retry request", "toast lỗi", "trang trắng khi lỗi", "SSE mất event", "màn hình lỗi cho route", "lỗi phân quyền render tạm". Đọc TRƯỚC khi tự viết try/catch fetch hay tự navigate('/login').
---

# Error handling FE: đúng lớp, fail-closed

> **One-thing**: lỗi hiển thị/khôi phục ở FE. Phần lớn đã có sẵn — **đừng làm lại**, hãy nối vào.

## Cái gì ĐÃ tự xử (đừng viết lại)

| Lỗi | Đã xử ở đâu | Bạn KHÔNG cần |
|---|---|---|
| Non-2xx | `@repo/core` `apiClient` ném **`ApiError`** (`.status`, `.retryAfterMs`, `.data`) | tự parse response |
| **401** (mất session) | `apiClient` gọi `onUnauthorized()` → `/login?redirect=` | tự `navigate('/login')` rải rác |
| **503** (quá tải) | `apiClient` backoff theo `Retry-After` (mặc định retry 2 lần) | tự retry-loop |
| Retry policy | `createQueryClient`: KHÔNG retry 4xx (401/403/404/422), retry 2 cho 5xx, mutation retry 0 | set retry per-query |
| SSE fatal 401/403 | `sse.ts` `isFatalStatus` → `onClosed("fatal")` + `notifyUnauthorized()` | tự đóng stream |

401 xử **một chỗ**: `setUnauthorizedHandler(router.navigate...)` ở tầng app; apiClient **và** SSE cùng gọi
`notifyUnauthorized`. Thêm điểm phát hiện session chết mới → gọi `notifyUnauthorized()`, đừng navigate tay.

## Quyết định — hiển thị lỗi ở đâu

- **Lỗi cả route/loader** → `errorComponent` của route. Boundary gốc = `errorComponent` ở `__root.tsx` (đã gọi
  `Sentry.captureException`). **KHÔNG** thêm `<Sentry.ErrorBoundary>` (double-instrument) — dùng `errorComponent`.
- **Lỗi 1 khối dữ liệu** (1 card lỗi, phần còn lại ok) → check `query.isError` render UI lỗi cục bộ + nút thử lại.
- **Lỗi action** (submit, mutation) → `toast.error` (sonner). **Lỗi field** (validate) → `<FormMessage>` inline
  (skill `forms-rhf-zod`). Đừng toast cho lỗi field, đừng inline cho lỗi mạng.
- Phân nhánh theo `err instanceof ApiError && err.status === ...` khi cần message riêng.

## Quyết định — FAIL-CLOSED (nguyên tắc, OWASP A10)

Lỗi khi **kiểm quyền/vai** = coi như **KHÔNG có quyền**, không "render tạm rồi check sau".

- `sessionQueryOptions` (`@repo/auth/session.ts`) **đã fail-closed**: `getSession()` lỗi/không BE/401 → `null`
  = chưa đăng nhập → guard `beforeLoad` redirect `/login`. **GIỮ NGUYÊN** — đừng đổi thành "lỗi thì cho vào".
- `requireRoles` deny khi thiếu role. ⚠️ Route guard là **UX, không phải security** — BE re-check mọi API. Đừng
  ẩn nút = coi là bảo mật; BE mới là hàng rào (skill `protect-route`).

## GOTCHAS (đã trả giá thật)

- **SSE at-most-once** → `onReconnect` PHẢI `invalidateQueries` các key liên quan (event phát lúc client rớt là
  MẤT, không replay). Không refetch-bù = UI hiển thị data cũ sau khi mạng chập chờn. Skill `consume-sse`.
- **open-redirect** `?redirect=//evil.com` ở `/login` → sanitize trong `validateSearch` (chỉ path nội bộ, chặn
  `//` và `https://`). Đừng `navigate(redirect)` mù.
- **Thiếu `apps/<app>/.env` = trang trắng** (BUG-007): `lib/env.ts` throw lúc import → React không mount →
  error-boundary trắng, **không lỗi env nào hiện ra**. Trước khi kết luận "lỗi code": `cp .env.example .env`.
- **Đừng nuốt lỗi**: `catch {}` rỗng che bug + không tới Sentry. Để lỗi nổi lên errorComponent (Sentry bắt) hoặc
  xử tường minh. Fail-open ("lỗi thì cho qua") ở nhánh quyền = lỗ hổng, không phải UX mượt.
- **Build warning `common.json INEFFECTIVE_DYNAMIC_IMPORT`** (KI-3) là **kỳ vọng** (common eager có chủ đích),
  KHÔNG phải lỗi — đừng "sửa".

## Cross-reference

`connect-api` + `.claude/rules/data-fetching.md` (ApiError, retry) · `consume-sse` (refetch-bù) ·
`sentry-frontend` (captureException, source map) · `protect-route` + `.claude/rules/auth.md` (fail-closed guard) ·
`forms-rhf-zod` (lỗi field) · `state-management`.
