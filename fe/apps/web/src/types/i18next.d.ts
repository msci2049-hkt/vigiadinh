import "i18next";
import type { defaultNS, I18nResources } from "@/lib/i18n";

/**
 * Type-safe `t()`: keys + namespaces are derived from the static `vi` resource
 * shapes (compile-time only — `I18nResources` is erased at build, so lazy runtime
 * loading is unaffected), so `useTranslation("dashboard").t("summary.title")`
 * autocompletes and a typo is a compile error. `en` matches the same shape.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: I18nResources;
  }
}
