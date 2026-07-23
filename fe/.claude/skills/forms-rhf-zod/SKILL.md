---
name: forms-rhf-zod
description: Dựng form đúng chuẩn repo này — React Hook Form (uncontrolled) + Zod 4 làm 1 nguồn sự thật + shadcn Form. Xử lý validate, lỗi server→field, wizard nhiều bước, và các bẫy Zod-4/RHF thật (transform lệch input/output type, 2 bản zod trong node_modules, z.coerce.number dưới exactOptionalPropertyTypes, selector input-otp). Dùng khi user gõ "tạo form", "form đăng nhập/đăng ký", "validate form", "react hook form", "zodResolver lỗi type", "expected a Zod schema", "form nhập số ra NaN", "lỗi hiển thị dưới field", "multi-step form / wizard". Đọc TRƯỚC khi viết form để không dính bẫy type Zod 4.
---

# Forms: React Hook Form + Zod 4 + shadcn

> **One-thing**: form state + validate. Quy ước cơ bản (schema ở `<feature>/schemas`, bọc `<Form>`, lỗi qua
> `sonner`) nằm ở `.claude/rules/forms.md` — skill này lo *quyết định + bẫy version*. Tạo form cơ học → `new-form`.

## Ground truth (version thật, KHÔNG bịa)

`react-hook-form ^7.80.0` · `@hookform/resolvers ^5.4.0` (Zod 4 **cần resolvers ≥5.2**) · `zod ^4.4.3`.
Mẫu thật: `features/auth/components/login-form.tsx` + `schemas/login-schema.ts`.

## Cấu trúc chuẩn (theo mẫu login)

```ts
// schemas/login-schema.ts — Zod 4: z.email() top-level, { error } thay message
export function makeLoginSchema(t: (k: string) => string) {
  return z.object({
    email: z.email({ error: t("login.errors.email") }),
    password: z.string().min(8, { error: t("login.errors.password") }),
  });
}
export type LoginInput = z.infer<ReturnType<typeof makeLoginSchema>>;
```

```tsx
// component — uncontrolled, resolver, shadcn Form
const form = useForm<LoginInput>({ resolver: zodResolver(makeLoginSchema(t)), defaultValues: {...} });
<Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>
  <FormField control={form.control} name="email" render={({ field }) =>
    <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
</form></Form>
```

Quy tắc: 1 schema = nguồn sự thật (đừng validate tay rải rác); disable nút khi `submitting`; lỗi field →
`<FormMessage>` (inline), lỗi submit/action → `toast.error` (sonner). Schema có message i18n → **factory nhận
`t`** (`makeXSchema(t)`) rồi `useMemo(() => makeXSchema(t), [t])` — đừng dựng schema mới mỗi render.

## Server error → field

```ts
const { error } = await signIn.email({ ... });
if (error) { toast.error(error.message); return; }         // lỗi chung → toast
// hoặc gắn vào field cụ thể:
form.setError("email", { message: "Email đã tồn tại" });
```

## GOTCHAS (Zod 4 + RHF — đã trả giá / web-verified 2026-07)

- **Schema có `.transform()`/`.default()` → input type ≠ output type** → `z.infer` (= output) không khớp thứ
  form nhận (= input) → TS báo `input<T> not assignable`. Fix: khai **3 generic**:
  ```ts
  useForm<z.input<typeof schema>, any, z.output<typeof schema>>({ resolver: zodResolver(schema) })
  ```
  (react-hook-form/resolvers#800). Schema KHÔNG transform (như login) thì `useForm<z.infer<...>>` là đủ.
- **2 bản zod trong `node_modules`** (một lib kéo zod v3) → runtime `"expected a Zod schema"` hoặc type
  `input<T> not assignable`. Soi bằng `pnpm why zod` → dedupe/pin về 1 bản v4. Đây là bẫy nâng cấp hay gặp.
- **`z.coerce.number()` lệch input/output dưới `exactOptionalPropertyTypes`** (bật trong repo) → dùng
  `z.number()` + `register(name, { valueAsNumber: true })` thay coerce. Mẫu thật: `apps/carbon/.../admin-schema.ts`
  + `create-commune-form.tsx` (comment: `valueAsNumber → number (NaN khi rỗng); nonnegative loại NaN`).
- **input-otp trong shadcn `<FormControl>`** (Radix `Slot`) **ghi đè `data-slot`** của child → selector
  `[data-slot="input-otp"]` match 0 element, e2e treo 30s (BUG-006). Selector ĐÚNG: `input[data-input-otp]`.
- **biome a11y `noLabelWithoutControl`** khi `<label>`/`<FormLabel>` bọc `<Input>` (component, không phải
  `<input>` native) → thêm `// biome-ignore lint/a11y/noLabelWithoutControl` theo pattern Field có sẵn.
- **`resolvers < 5.2` với zod 4** = type/runtime vỡ. Repo pin `^5.4.0` — đừng hạ.

## Cross-reference

`.claude/rules/forms.md` · `state-management` (form ≠ server state) · `connect-api` (gửi form lên API) ·
`error-handling-fe` (lỗi submit) · skill `new-form` · `new-component` (shadcn Form).
