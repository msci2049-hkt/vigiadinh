---
appliesTo: "src/features/**, src/app/**"
---

# Rule: Module boundary (feature-based)

**Nguyên tắc:** mỗi `src/features/<x>/` **tự chứa**. Phụ thuộc chỉ đi MỘT chiều:
`app/` → `features/` → (`components/`, `lib/`, `stores/`, `config/`). KHÔNG ngược lại.

## DON'T (sẽ bị `packages/config/scripts/check-boundaries.mjs` chặn — gọi qua script `boundaries` của từng app, chạy trong `pnpm validate`; file `scripts/check-boundaries.ts` KHÔNG tồn tại)
- ❌ Feature A import feature B: `import ... from "@/features/B/..."` (kể cả relative `../../B`).
- ❌ Feature import tầng app: `import ... from "@/app/..."`.

## DO
- Cần dùng chung giữa feature → đẩy xuống `@/components`, `@/lib`, `@/hooks`, `@/stores`.
- Cần ghép nhiều feature → ghép ở **tầng `app/`** (route component compose các feature).
  Ví dụ: `routes/_authenticated/route.tsx` dùng session (auth) rồi các màn con compose
  feature tương ứng và truyền dữ liệu xuống (demo dashboard cũ đã gỡ ở PHA 1.5).
- **KHÔNG barrel file lớn** (`index.ts` re-export hàng loạt) — phá tree-shaking, chậm HMR.
  Import trực tiếp từng file.

## Kiểm tra
`pnpm boundaries` (hoặc `pnpm validate`). Vi phạm → in rõ file + import sai → exit 1.

Liên quan: `skills/new-feature`, `CLAUDE.md §2`.
