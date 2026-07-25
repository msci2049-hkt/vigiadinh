import { initI18n } from "@repo/i18n";
// EAGER: `common` ships in the entry so the shared chrome never flashes raw keys.
import common_en from "../locales/en/common.json";
// TYPE-ONLY (erased at build — NOT bundled): used solely for type-safe t().
import type admin_vi from "../locales/vi/admin.json";
import type auth_vi from "../locales/vi/auth.json";
import common_vi from "../locales/vi/common.json";
import type errors_vi from "../locales/vi/errors.json";
import type fw_vi from "../locales/vi/fw.json";
import common_zh from "../locales/zh/common.json";

export const defaultNS = "common";

/** Compile-time shape of ALL namespaces for type-safe t() (erased at runtime). */
export interface I18nResources {
  common: typeof common_vi;
  auth: typeof auth_vi;
  errors: typeof errors_vi;
  admin: typeof admin_vi;
  /** FamilyWallet screens (8 nhóm màn hình — xem CLAUDE.md). */
  fw: typeof fw_vi;
}

// Lazy namespaces (`auth`/`errors`/`admin`/`fw`) stay OUT of the entry.
// The glob deliberately excludes `common`: it is already eager above, and including
// it in a dynamic-import graph makes Vite emit a misleading static/dynamic warning.
const lazyNamespaces = import.meta.glob("../locales/*/{admin,auth,errors,fw}.json");

function loadNamespace(lng: string, ns: string): Promise<unknown> {
  const loader = lazyNamespaces[`../locales/${lng}/${ns}.json`];
  return loader
    ? loader()
    : Promise.reject(new Error(`Unsupported locale namespace: ${lng}/${ns}`));
}

// zh = Chinese (Simplified). `load: "languageOnly"` gộp zh-CN/zh-Hans/zh-TW → "zh"
// nên MỘT catalog "zh" phục vụ mọi biến thể; nội dung là Giản thể (skill i18n-en-vi-zh).
const i18n = initI18n({
  defaultLocale: "en",
  supportedLngs: ["en", "vi", "zh"],
  eagerResources: {
    vi: { common: common_vi },
    en: { common: common_en },
    zh: { common: common_zh },
  },
  loadNamespace,
  defaultNS,
});

export default i18n;
