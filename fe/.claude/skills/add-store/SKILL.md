---
name: add-store
description: Tạo Zustand store cho UI state TOÀN CỤC (không phải server state — đó là việc của TanStack Query). Theo mẫu theme-store.
---
# Thêm Zustand store

## Khi nào dùng
CHỈ cho UI state global, đồng bộ giữa các route (vd: theme, ngôn ngữ, sidebar mở/đóng, modal global). Dữ liệu từ BE → DÙNG TanStack Query, KHÔNG nhét vào store.

## Các bước
1. Tạo file ở `src/stores/<ten>-store.ts`.
2. Khai báo interface state + actions (đặt action cùng store, không tách lung tung).
3. `create<T>()(...)`. Cần lưu localStorage → bọc `persist(..., { name: '<key>' })` từ `zustand/middleware`.
4. Tiêu thụ bằng selector để tránh re-render thừa: `useXStore((s) => s.value)`.

## Ví dụ
```ts
// theo src/stores/theme-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
interface SidebarState { open: boolean; toggle: () => void }
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({ open: true, toggle: () => set((s) => ({ open: !s.open })) }),
    { name: "app-sidebar" },
  ),
);
```

## Lưu ý / cạm bẫy
- ĐỪNG lưu danh sách/đối tượng lấy từ API vào store — đó là server state, để Query cache + invalidate.
- Không lưu thông tin nhạy cảm (token, session) — session là cookie do Better Auth quản lý.
- Đặt `name` persist là duy nhất (tránh đụng key localStorage).
- Logic side-effect (vd toggle class `.dark`) tách thành hook init riêng như `useThemeInit`.

## Liên quan
[rules/state.md], skills/connect-api; mẫu: `src/stores/theme-store.ts`
