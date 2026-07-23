---
appliesTo: "src/features/**/components/*form*.tsx, src/features/**/schemas/**"
---

# Rule: Forms (React Hook Form + Zod v4 + shadcn Form)

## Cấu trúc
- **Schema Zod** ở `<feature>/schemas/<name>-schema.ts`, export cả type. Ngưỡng số
  (min/max length…) KHÔNG hardcode — đọc từ BE qua `useValidationLimits()` (D-052):
  ```ts
  import type { ValidationLimits } from "@/lib/validation-limits";

  export function makeSignupSchema(t: Messages, limits: ValidationLimits) {
    return z.object({
      email: z.email({ error: t("signup.errors.email") }),
      password: z
        .string()
        .min(limits.password.minLength, {
          error: t("signup.errors.password", { min: limits.password.minLength }),
        })
        .max(limits.password.maxLength, {
          error: t("signup.errors.passwordMax", { max: limits.password.maxLength }),
        }),
    });
  }
  export type SignupInput = z.infer<ReturnType<typeof makeSignupSchema>>;
  ```
- **Form** = RHF + `zodResolver` (từ `@hookform/resolvers/zod`) + shadcn `Form` components:
  ```ts
  const limits = useValidationLimits();
  const form = useForm<SignupInput>({
    resolver: zodResolver(useMemo(() => makeSignupSchema(t, limits), [t, limits])),
    defaultValues: {...},
  });
  ```
  Bọc `<Form {...form}>` → `<FormField ... render={({ field }) => <FormItem><FormControl><Input {...field}/>…`.

## DO
- Validate MỌI input bằng Zod (Zod v4: dùng top-level `z.email()`, `z.url()`; tùy chỉnh lỗi `{ error }`).
- **Ngưỡng validate = của BE** (`GET /api/config/validation` → `@/lib/validation-limits`).
  `min(1)` cho "required" thì được; số ≥ 2 trong schema sẽ bị guard
  `scripts/check-validation-parity.mjs` chặn (ngoại lệ → ALLOWLIST kèm reason).
- Submit qua handler async, hiển thị lỗi bằng `toast` (sonner). Disable nút khi đang gửi.
- Mẫu tham chiếu: `apps/web/src/features/auth/components/signup-form.tsx` (limits) và
  `login-form.tsx` (form đơn giản).

## DON'T
- Đừng dùng `any` cho values — luôn `useForm<T>()` từ `z.infer`.
- Đừng validate thủ công rải rác — một schema là nguồn sự thật.
- **Đừng lặp lại ngưỡng của BE bằng số cứng** (bug D-051: FE min 8 vs BE min 12 —
  user qua form rồi bị BE chửi "Password is too short").
- Login KHÔNG check độ dài password (chỉ `min(1)` required) — Better Auth không
  validate minPasswordLength ở sign-in; ngưỡng độ dài thuộc về sign-up/reset.

Liên quan: `skills/new-form`, `rules/data-fetching.md` (gửi form lên API).
