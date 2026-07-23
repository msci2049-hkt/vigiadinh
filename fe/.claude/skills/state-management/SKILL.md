---
name: state-management
description: Chọn ĐÚNG chỗ giữ state trong FE này theo category-first — mỗi loại state một công cụ, cấm trộn. Server state → TanStack Query (LUÔN LUÔN, không copy vào Zustand); form → RHF+Zod; URL/filter/thứ shareable → search params; UI cục bộ → useState; UI toàn cục (theme…) → Zustand. Dùng khi user gõ "quản lý state", "dùng Zustand hay Query", "lưu data ở đâu", "global state", "state chia sẻ giữa component", "context hay store", "data fetch xong để đâu", "filter/tab trên URL", "re-render nhiều lần khi select store", "useShallow". Đọc TRƯỚC khi tạo store hay quyết định giữ dữ liệu ở đâu — sai layer là nguồn bug đồng bộ số 1.
---

# State management: category-first

> **Luật vàng FE**: mỗi *loại* state có ĐÚNG một công cụ. Trộn = bug đồng bộ. Quyết định theo bản chất
> dữ liệu, KHÔNG theo "cái nào tiện".

## Bảng quyết định (thuộc về loại nào → dùng cái đó)

| Loại state | Công cụ | Vì / điểm neo thật trong repo |
|---|---|---|
| **Server state** (data từ BE) | **TanStack Query — LUÔN** | Query lo cache/stale/refetch/retry. `@repo/core` `createQueryClient()`. Mẫu: `features/users-management/api/admin-users-api.ts` (key factory + `queryOptions`). |
| Form đang nhập | **RHF + Zod** | Uncontrolled, validate 1 schema. Skill `forms-rhf-zod`. |
| URL / filter / thứ **shareable** | **search params** (`validateSearch` Zod) | Paste link phải ra đúng view. `.claude/rules/routing.md`. |
| UI cục bộ 1 component (mở/đóng, hover) | `useState` | Không ai khác cần biết. |
| UI **toàn cục** (theme, sidebar, command-menu) | **Zustand** | Chỉ preference/UI, KHÔNG phải data server. Mẫu duy nhất: `@repo/ui` `theme-store.ts`. |

## Anti-pattern #1 (cấm): fetch API rồi nhét Zustand tự sync

```ts
// ❌ SAI — server data vào Zustand, tự viết loading/refetch/invalidate lại từ đầu
const useUsers = create((set) => ({ users: [], fetch: async () => set({ users: await api.get(...) }) }));
// ✅ ĐÚNG — Query sở hữu server state
export const usersOptions = () => queryOptions({ queryKey: usersKeys.all, queryFn: () => apiClient.get(...) });
```

**Test 1 câu**: "Dữ liệu này có nguồn ở BE không?" → CÓ thì là server state → Query, KHÔNG BAO GIỜ Zustand.
"User paste link có cần ra đúng view không?" → CÓ thì là URL state → search params, không Zustand.

## Zustand: chỉ UI toàn cục, đúng chuẩn theme-store

- Store **singleton đặt ở package dùng chung** khi >1 app cần (theme ở `@repo/ui`, không copy mỗi app).
- **Persist** qua `persist(..., { name })` khi cần nhớ qua reload (theme → localStorage `ui-theme`).
- **Dọn listener**: effect init phải cleanup (mẫu `useThemeInit`: `mq.addEventListener` → `removeEventListener`
  trong return) — không dọn = leak + double-fire sau HMR.
- ⚠️ `apps/web` **không khai `zustand` trực tiếp** (chỉ dùng gián tiếp qua `@repo/ui` theme-store). Cần global
  UI state mới → cân nhắc đặt ở `@repo/ui` hoặc thêm dep có chủ đích, đừng import chéo package bừa.

## GOTCHAS (Zustand 5 — version repo `^5.0.14`)

- **Bỏ default export**: `import { create } from "zustand"` (KHÔNG `import create from "zustand"`). Code cũ
  copy sang = import lỗi.
- **Bỏ equality mặc định**: select ra **object/array** mà không `useShallow` → component re-render MỖI lần
  store đổi (dù phần chọn không đổi). Chọn 1 primitive thì OK; chọn nhiều field → `useShallow`:
  ```ts
  import { useShallow } from "zustand/react/shallow";
  const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })));
  ```
- **`invalidateQueries` trong render = vòng lặp refetch** (đây là Query, không Zustand, nhưng cùng lỗi "state
  sai chỗ"): chỉ invalidate trong event handler / `onSuccess` / `onReconnect`. Xem `.claude/rules/data-fetching.md`.
- **queryKey object/array mới mỗi render** → Query coi là key mới → refetch vô tận. Dùng key factory ổn định.

## Cross-reference

`forms-rhf-zod` (form state) · `connect-api` + `.claude/rules/data-fetching.md` (server state) ·
`.claude/rules/routing.md` (URL state) · `error-handling-fe` (lỗi khi fetch) · skill `add-store` (tạo Zustand store) ·
`consume-sse` (realtime → invalidate, không tự nhét store).
