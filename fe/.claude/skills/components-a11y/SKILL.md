---
name: components-a11y
description: Dựng component đúng & accessible trong FE này — dùng shadcn/Radix (primitive đã lo keyboard nav + focus trap, đừng tự viết), token semantic, biome a11y gate, và tránh bẫy Radix Slot ghi đè data-slot. Dùng khi user gõ "tạo component", "shadcn", "modal / dialog / dropdown", "accessible / a11y", "keyboard navigation", "focus trap", "aria", "biome báo lỗi a11y", "label không gắn control", "component không bấm được bằng bàn phím". Đọc TRƯỚC khi tự viết dialog/menu/tooltip từ div — a11y tự chế gần như luôn thiếu.
---

# Components + a11y: shadcn/Radix, đừng tự chế

> **One-thing**: quyết định *dựng component thế nào cho accessible*. Thao tác thêm component cơ học → skill
> `new-component`. Style/token → `styling-tailwind`.

## Quyết định — dùng primitive Radix, không dựng lại

- Component tương tác (dialog, dropdown, select, tooltip, popover, tabs) → **shadcn/ui** (Radix bên dưới): đã lo
  **keyboard nav, focus trap, aria-*, escape/click-outside, focus return**. Tự viết bằng `<div onClick>` gần như
  luôn thiếu (không tab được, screen-reader mù). Thêm: `pnpm dlx shadcn@latest add <name> -y -o` (style new-york).
  Ta SỞ HỮU code trong `packages/ui/src/components` (button, dialog, dropdown-menu, form, select, input-otp…) → sửa tự do.
- Component hiển thị thuần (card, badge) → tự do, nhưng vẫn dùng thẻ semantic (`<button>` cho hành động, KHÔNG
  `<div onClick>`; heading đúng cấp; `<nav>`/`<main>`).

## a11y bắt buộc (biome gate + tay)

- **biome a11y** (recommended, chạy trong `pnpm validate`) bắt nhiều lỗi: thiếu `type` cho button, `alt` cho img,
  label không gắn control, `onClick` trên non-interactive… Đỏ = không commit được. Đừng tắt rule — sửa markup.
- **Label ↔ control**: mỗi input có label liên kết (shadcn `<FormLabel>` + `<FormControl>` lo `id`/`htmlFor`).
- **Focus nhìn thấy**: giữ ring focus (token `ring`), đừng `outline-none` trần.
- **Ảnh/icon ý nghĩa** có `alt`/`aria-label`; icon trang trí `aria-hidden`.
- **Màu không phải kênh duy nhất** truyền trạng thái (thêm icon/text cho lỗi, không chỉ đỏ).

## GOTCHAS (đã trả giá thật)

- **Radix `Slot` ghi đè `data-slot` của child** (BUG-006): `<FormControl>` (Radix `Slot`) đặt `data-slot="form-control"`
  đè lên `data-slot="input-otp"` của child → selector `[data-slot="input-otp"]` match 0 element (e2e treo 30s). Test
  input-otp bằng `input[data-input-otp]` (attribute primitive tự đặt), KHÔNG `data-slot`. Đây là bẫy chung của mọi
  component bọc trong `<FormControl>`. Xem `forms-rhf-zod` / `testing-fe`.
- **biome `noLabelWithoutControl`** khi `<label>`/`<FormLabel>` bọc `<Input>` (component, không phải `<input>` native)
  → biome không thấy control → thêm `// biome-ignore lint/a11y/noLabelWithoutControl` theo pattern Field có sẵn
  (ERRORS.md). Chỉ ignore khi control THỰC SỰ có, đừng lạm dụng.
- **`<div onClick>` cho hành động** = không tab/enter được + screen-reader bỏ qua → dùng `<button type="button">`.
- **Màu thô thay token** → dark mode + contrast vỡ. Dùng token semantic (`styling-tailwind`).

## Cross-reference

skill `new-component` · `styling-tailwind` (token, cn) · `forms-rhf-zod` (FormControl, input-otp) · `testing-fe`
(query by role, selector) · `.claude/rules/styling.md`.
