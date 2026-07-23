---
name: styling-tailwind
description: Style đúng chuẩn Tailwind v4 CSS-first cho monorepo này — token semantic OKLCH (không màu thô), cn() gộp class, dark mode qua .dark trên <html>, và BẮT BUỘC @source cho class nằm ở package khác (nếu quên, class @repo/ui bị purge "tàng hình"). Dùng khi user gõ "style component", "Tailwind", "dark mode", "màu theme", "class không ăn / bị mất", "@source", "safelist", "class động", "màu OKLCH", "tailwind.config đâu". Đọc TRƯỚC khi thêm class từ package chung hay tạo class động — purge im lặng là bug khó thấy nhất.
---

# Styling: Tailwind v4 CSS-first

> **One-thing**: quyết định *cách style*. Quy ước cơ bản (token semantic, cn(), `.dark`, không màu thô) ở
> `.claude/rules/styling.md` — skill này lo *bẫy v4/monorepo*. Version repo: `tailwindcss ^4.3.1` + `@tailwindcss/vite`
> (KHÔNG PostCSS, KHÔNG `tailwind.config.js`). Thêm component shadcn → skill `new-component`.

## CSS-first (mẫu thật `apps/web/src/index.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@repo/ui/theme.css";
/* Class ở package NGOÀI app root → Tailwind không quét được nếu thiếu @source: */
@source "../../../packages/ui/src";     /* ⬅ thiếu dòng này = class @repo/ui bị purge, UI vỡ âm thầm */
```

Token OKLCH khai ở `:root`/`.dark` (trong `theme.css` của @repo/ui), map sang utility qua `@theme inline`. Dark
mode = class `.dark` trên `<html>` (quản bởi `@repo/ui` theme-store `useThemeInit`). Variant:
`@custom-variant dark (&:is(.dark *))`.

## Quyết định — token semantic, không màu thô

`bg-background text-foreground border-border bg-primary text-muted-foreground` … — dùng token để dark/theme hoạt
động. `bg-gray-200` cho UI chính = dark mode không đổi màu. Gộp class có điều kiện bằng `cn()` (`@/lib/utils`).

## GOTCHAS (Tailwind v4 / v4.1 — web-grounded)

- **Quên `@source` cho package khác = class "tàng hình"** (bị purge, không báo lỗi). Đây là gotcha monorepo số 1 —
  repo đã có `@source "../../../packages/ui/src"`; thêm package UI mới → thêm `@source` tương ứng.
- **Safelist cũ chết** → dùng **`@source inline("...")`** cho class sinh động (không xuất hiện literal trong code,
  vd tên class ghép runtime). **`@source not "..."`** để loại path khỏi quét.
- **JS config KHÔNG auto-detect nữa** (v4.1): còn `tailwind.config.js` thì phải khai `@config "./tailwind.config.js"`
  tường minh, nếu không theme trong đó **biến mất không báo lỗi**. Repo này CSS-first thuần → không có config.js, đừng
  thêm lại.
- **Bọc token OKLCH bằng `hsl(...)`** = sai (theme là OKLCH). Để giá trị ở `:root`/`.dark`, chỉ map `var()` trong
  `@theme inline` — đừng nhét màu trực tiếp vào `@theme` rồi mong `.dark` đổi.
- **v4.1 có sẵn** `text-shadow-*`, `mask-*`, `wrap-break-word` → thôi viết custom CSS cho mấy cái này.
- **CSP hash cho FOUC script**: đổi script chống nháy theme trong `index.html` → regenerate sha256 trong
  `deploy/nginx.conf` (nếu không CSP chặn). Xem `.claude/rules/styling.md` + README.

## Cross-reference

`.claude/rules/styling.md` · skill `new-component` (shadcn add) · `components-a11y` (token + a11y) · `state-management`
(theme-store Zustand) · `build-safety-cloudflare` (nginx CSP).
