import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

export interface InitI18nOptions {
  /** App default language — becomes `fallbackLng`. */
  defaultLocale: string;
  supportedLngs: readonly string[];
  /**
   * Namespaces bundled INTO the entry chunk (usually just `common` so the
   * shared chrome never flashes raw keys before first paint).
   */
  eagerResources: Record<string, Record<string, object>>;
  /**
   * Lazy loader for everything else. MUST live in the APP (not here) so Vite's
   * glob analysis code-splits each `src/locales/<lng>/<ns>.json`:
   *   (lng, ns) => import(`../locales/${lng}/${ns}.json`)
   */
  loadNamespace: (lng: string, ns: string) => Promise<unknown>;
  defaultNS?: string;
}

/**
 * Shared i18next bootstrap (i18next + react-i18next + detector +
 * resources-to-backend). Each app calls this ONCE from its `src/lib/i18n.ts`
 * wrapper, passing its own locales; type-safe `t()` stays app-side via the
 * app's `types/i18next.d.ts`.
 *
 * - **Lazy namespaces:** only `eagerResources` ship in the entry
 *   (`partialBundledLanguages`); the rest arrive on demand the first time
 *   `useTranslation(ns)` runs for a route.
 * - Detection: localStorage → navigator; cached to localStorage (switcher persists).
 */
export function initI18n(options: InitI18nOptions): typeof i18n {
  const {
    defaultLocale,
    supportedLngs,
    eagerResources,
    loadNamespace,
    defaultNS = "common",
  } = options;

  void i18n
    .use(ICU) // PHA 7.1: message syntax = ICU ({var}, {n, plural, ...}) — KHÔNG {{var}}
    .use(resourcesToBackend(loadNamespace))
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: eagerResources,
      partialBundledLanguages: true, // bundled eager namespaces + backend for the rest
      defaultNS,
      ns: Object.keys(eagerResources[defaultLocale] ?? {}),
      fallbackLng: defaultLocale,
      supportedLngs: [...supportedLngs],
      load: "languageOnly",
      interpolation: { escapeValue: false }, // React already escapes
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
      react: { useSuspense: false },
      // Key thiếu ở MỌI fallback → chuỗi RỖNG, cấm lộ key thô ra màn (luật i18n N5).
      saveMissing: false,
      parseMissingKeyHandler: () => "",
    });

  return i18n;
}

export { i18n };
