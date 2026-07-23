---
name: new-component
description: Thêm component shadcn/ui (pnpm dlx shadcn add) hoặc component feature; dùng cn() và token Tailwind, không màu tuỳ tiện.
---
# Thêm component

## Khi nào dùng
Khi cần một primitive UI (button, dialog…) hoặc component riêng của feature.

## Các bước (component shadcn)
1. Cài: `pnpm dlx shadcn@latest add <name> -y -o` (vd `dialog`). File rơi vào `src/components/ui/` (style `new-york`, ta SỞ HỮU code).
2. Import qua alias `@/components/ui/<name>`.

## Các bước (component feature)
1. Đặt ở `src/features/<x>/components/<ten>.tsx`; props rõ ràng (interface), KHÔNG `any`.
2. Ghép class bằng `cn(...)` từ `@/lib/utils` (clsx + tailwind-merge) để override an toàn.
3. Dùng TOKEN ngữ nghĩa của theme (`bg-background`, `text-muted-foreground`, `bg-primary`…), KHÔNG màu hex/arbitrary.
4. Dark mode tự chạy qua class `.dark` trên `<html>` (theme-store) — chỉ cần dùng token đúng.

## Ví dụ
```tsx
import { cn } from "@/lib/utils";
export function Stat({ active, className }: { active?: boolean; className?: string }) {
  return <span className={cn("rounded bg-muted px-2 py-1 text-sm", active && "bg-primary text-primary-foreground", className)} />;
}
```

## Lưu ý / cạm bẫy
- Đừng sửa file `src/components/ui/*` lung tung khi có thể compose; nếu sửa, giữ nhất quán token.
- Token định nghĩa trong `src/index.css` (`@theme inline`, OKLCH). Cần màu mới → thêm token ở đó, đừng hardcode.
- Component feature ≤ 200 dòng. Không import chéo feature.
- Icon dùng `lucide-react`.

## Liên quan
skills/new-form, skills/add-store; nguồn: `src/lib/utils.ts`, `src/index.css`, `components.json`; mẫu: `src/components/ui/button.tsx`
