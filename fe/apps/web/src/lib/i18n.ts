import { initI18n } from "@repo/i18n";
// EAGER: `common` ships in the entry so the shared chrome never flashes raw keys.
import common_en from "../locales/en/common.json";
// TYPE-ONLY (erased at build — NOT bundled): used solely for type-safe t().
import type admin_vi from "../locales/vi/admin.json";
import type auth_vi from "../locales/vi/auth.json";
import common_vi from "../locales/vi/common.json";
import type dashboard_vi from "../locales/vi/dashboard.json";
import type errors_vi from "../locales/vi/errors.json";
import type fw_vi from "../locales/vi/fw.json";

export const defaultNS = "common";

/** Compile-time shape of ALL namespaces for type-safe t() (erased at runtime). */
export interface I18nResources {
  common: typeof common_vi;
  auth: typeof auth_vi;
  dashboard: typeof dashboard_vi;
  errors: typeof errors_vi;
  admin: typeof admin_vi;
  /** FamilyWallet screens (8 nhóm màn hình — xem CLAUDE.md). */
  fw: typeof fw_vi;
}

// Lazy namespaces (`auth`/`dashboard`/`errors`/`admin`/`fw`) stay OUT of the entry —
// Vite code-splits each `src/locales/<lng>/<ns>.json` chunk; the template
// literal MUST live in the app (not @repo/i18n) so Vite's glob analysis sees it.
const i18n = initI18n({
  defaultLocale: "en",
  supportedLngs: ["en", "vi"],
  eagerResources: {
    vi: { common: common_vi },
    en: { common: common_en },
  },
  loadNamespace: (lng: string, ns: string) => import(`../locales/${lng}/${ns}.json`),
  defaultNS,
});

export default i18n;
