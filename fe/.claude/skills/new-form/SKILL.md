---
name: new-form
description: Tạo form bằng React Hook Form + zodResolver + shadcn Form; schema đặt ở <feature>/schemas; submit kèm toast (sonner).
---
# Tạo form mới

## Khi nào dùng
Khi cần form có validate. Stack: React Hook Form + `zodResolver` + component `Form` của shadcn + thông báo bằng `sonner`.

## Các bước
1. Tạo schema ở `src/features/<x>/schemas/<x>-schema.ts` (Zod v4) và export type suy ra bằng `z.infer`.
2. Component: `useForm<T>({ resolver: zodResolver(schema), defaultValues })`.
3. Bọc `<Form {...form}>` rồi dùng `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` (`@/components/ui/form`). Nếu thiếu component shadcn → xem `new-component`.
4. `onSubmit` qua `form.handleSubmit(onSubmit)`; gọi API (`apiClient`/`authClient`) trong đó.
5. Báo kết quả: `toast.success(...)` / `toast.error(...)` từ `sonner`. `Toaster` đã mount ở `provider.tsx`.

## Ví dụ
```tsx
// schema: src/features/auth/schemas/login-schema.ts
import { z } from "zod";
export const loginSchema = z.object({
  email: z.email({ error: "Email không hợp lệ" }),
  password: z.string().min(8, { error: "Mật khẩu tối thiểu 8 ký tự" }),
});
export type LoginInput = z.infer<typeof loginSchema>;
// form: src/features/auth/components/login-form.tsx
const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
```

## Lưu ý / cạm bẫy
- `zodResolver` import từ `@hookform/resolvers/zod`. Zod v4: dùng `z.email()`, `z.url()` top-level và `{ error: '...' }` cho thông báo.
- Dùng `import type` khi import kiểu (vd `type LoginInput`) vì `verbatimModuleSyntax` bật.
- Để `FormMessage` tự hiển thị lỗi từ schema, đừng tự bắt lỗi field thủ công.

## Liên quan
skills/new-component, skills/connect-api; mẫu: `src/features/auth/components/login-form.tsx`, `src/features/auth/schemas/login-schema.ts`
