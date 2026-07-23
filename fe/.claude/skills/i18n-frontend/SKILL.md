---
name: i18n-frontend
description: Đa ngôn ngữ đúng cách trong FE này — i18next + react-i18next qua @repo/i18n initI18n, namespace lazy (chỉ eager cái chung), pluralization, format số/ngày theo locale, cân nhắc RTL. Dùng khi user gõ "thêm ngôn ngữ", "i18n / đa ngôn ngữ", "dịch", "useTranslation", "namespace", "chuyển tiếng Anh/Việt", "format số theo locale", "text cứng trong code". Đọc TRƯỚC khi hardcode chuỗi UI hay thêm locale/namespace.
---

# i18n FE: i18next qua @repo/i18n

> **One-thing**: quyết định *cấu trúc dịch*. Cài i18n từ đầu (nếu dự án chưa có) → skill `add-i18n`. Ở template
> này i18n **đã bật** (vi/en) qua `@repo/i18n`.

## Ground truth (mẫu thật)

`@repo/i18n` `initI18n({ defaultLocale, supportedLngs, eagerResources, loadNamespace })` (`packages/i18n/src/init.ts`):
- **`eagerResources`** = namespace ship sẵn trong entry (chống nháy UI chung, vd `common`).
- **`loadNamespace: (lng, ns) => import(...)`** = namespace khác **lazy** (tải khi cần), `partialBundledLanguages:true`.
- `fallbackLng = defaultLocale`. Version: `i18next ^26.3.1` / `react-i18next ^17.0.8`.

Dùng: `const { t } = useTranslation("auth"); t("login.title")`. Key theo namespace (`auth`, `admin`, `common`…).

## Quyết định — namespace & eager vs lazy

- **Chia namespace theo feature** (`auth`, `admin`, `panels.<role>`), KHÔNG 1 file khổng lồ → lazy-load theo route,
  bundle nhỏ.
- **Chỉ `common` eager** (nút, nhãn dùng khắp nơi) — phần còn lại lazy. Thêm namespace mới → thường để lazy.
- Thêm role/panel → thêm key `panels.<role>.*` vào `locales/{vi,en}/common.json` (CLAUDE.md §8).

## Chuỗi UI — luôn qua `t()`, không hardcode

- Text hiển thị → key i18n (kể cả message lỗi form: schema factory nhận `t`, xem `forms-rhf-zod`
  `makeLoginSchema(t)`).
- **Pluralization**: dùng key `_one`/`_other` của i18next + `t("items", { count })` — đừng tự `if (n>1)`.
- **Format số/ngày theo locale**: `Intl.NumberFormat`/`Intl.DateTimeFormat` (hoặc helper `@repo/core` format) theo
  `i18n.language`, KHÔNG hardcode `.` / `,` / `dd/mm`.

## GOTCHAS

- **`common.json` build warning `INEFFECTIVE_DYNAMIC_IMPORT`** (KI-3) là **kỳ vọng**: `common` cố ý **eager**
  (static import vào entry, chống nháy) trong khi backend dynamic-import glob cũng khớp `common.json`. Vite giữ
  `common` ở entry → đúng ý đồ. **Vô hại — đừng "sửa".**
- **Key thiếu** → i18next hiện raw key (vd `login.title`) thay vì crash → dễ lọt lên UI. Thêm key vào **CẢ** `vi`
  **và** `en` cùng lúc.
- **Hardcode chuỗi** → không dịch được + lọt qua review. Grep chuỗi tiếng Việt/Anh cứng trong component khi thêm feature.
- **RTL** (nếu thêm ngôn ngữ RTL như Ả Rập): set `dir="rtl"` trên `<html>` theo locale + dùng logical properties
  (`ms-*`/`me-*` thay `ml-*`/`mr-*`). Template hiện chỉ vi/en (LTR).

## Cross-reference

skill `add-i18n` (cài từ đầu) · `forms-rhf-zod` (message i18n trong schema) · `new-component` · `state-management`
(ngôn ngữ hiện tại không phải server state) · `error-handling-fe` (message lỗi).
