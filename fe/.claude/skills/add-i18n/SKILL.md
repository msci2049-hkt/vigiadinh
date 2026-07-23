---
name: add-i18n
description: Cài đa ngôn ngữ bằng i18next + react-i18next (chưa có sẵn) — provider tối thiểu, ví dụ useTranslation, và thư mục locales.
---
# Thêm i18n (đa ngôn ngữ)

## Khi nào dùng
Khi cần dịch UI. Repo CHƯA cài i18n. Khuyến nghị `i18next` + `react-i18next`.

## Các bước
1. KIỂM TRA bản mới nhất trước khi cài (context7 / web), rồi: `pnpm add i18next react-i18next`.
2. Tạo `src/lib/i18n.ts` khởi tạo i18next (xem ví dụ).
3. Tạo thư mục locales: `src/locales/vi/common.json`, `src/locales/en/common.json`.
4. Import `@/lib/i18n` một lần trong `src/main.tsx` (hoặc `src/app/provider.tsx`) để init.
5. Dùng trong component: `const { t } = useTranslation(); t('common.greeting')`.

## Ví dụ
```ts
// src/lib/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "@/locales/vi/common.json";
import en from "@/locales/en/common.json";
void i18n.use(initReactI18next).init({
  resources: { vi: { common: vi }, en: { common: en } },
  lng: "vi", fallbackLng: "vi", defaultNS: "common",
  interpolation: { escapeValue: false },
});
export default i18n;
```
```tsx
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
return <h1>{t("greeting")}</h1>;
```

## Lưu ý / cạm bẫy
- Ngôn ngữ mặc định nên là `vi`. Đổi ngôn ngữ runtime: `i18n.changeLanguage('en')`.
- Nếu muốn nhớ lựa chọn ngôn ngữ → lưu vào Zustand store (xem `add-store`), KHÔNG để trong server state.
- Dùng `import type` cho type; JSON import bật sẵn trong Vite/TS.

## Liên quan
skills/add-store; nguồn: `src/main.tsx`, `src/app/provider.tsx`
