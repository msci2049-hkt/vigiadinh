---
appliesTo: "src/index.css, src/components/**, **/*.tsx (className), components.json"
---

# Rule: Styling (Tailwind v4 + shadcn/ui)

**CSS-first v4:** không có `tailwind.config.js`, không PostCSS/autoprefixer. Plugin
`@tailwindcss/vite`. Tokens (OKLCH) khai trong `src/index.css` (`:root` / `.dark`) và map sang
utility qua `@theme inline`.

## DO
- Dùng **token semantic**: `bg-background text-foreground border-border bg-primary text-muted-foreground`…
  (đừng dùng màu thô như `bg-gray-200` cho UI chính — dùng token để theme/dark hoạt động).
- Gộp class bằng `cn()` (`@/lib/utils`): `cn("base", condition && "x", className)`.
- Component dùng chung → shadcn/ui ở `src/components/ui` (thêm bằng
  `pnpm dlx shadcn@latest add <name> -y -o`, style **new-york**). Ta SỞ HỮU code này, sửa tự do.
- **Dark mode:** class `.dark` trên `<html>`, quản bởi `@/stores/theme-store` (`useThemeInit`).
  Variant: `@custom-variant dark (&:is(.dark *))`.

## DON'T
- Đừng thêm token màu trực tiếp vào `@theme` rồi mong `.dark` đổi — để giá trị ở `:root`/`.dark`,
  chỉ map `var()` trong `@theme inline`.
- Đừng bọc token OKLCH bằng `hsl(...)` (sai — đây là theme OKLCH).
- Hạn chế arbitrary values lung tung (`w-[123px]`) khi đã có scale; ưu tiên token + spacing chuẩn.

Liên quan: `skills/new-component`, `CODE_BASE_MAP.md` (mục index.css).
