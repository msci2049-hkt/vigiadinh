import { env } from "@/lib/env";

/**
 * App identity + nav — the SINGLE place for project-level constants (no scattering).
 * To rebrand a new project: set `VITE_APP_NAME` in `.env` (drives `name` + the tab
 * title) and edit `description` / `defaultLocale` here.
 * `labelKey` points at a `common` i18n key — labels are translated at render time.
 */
export const site = {
  /** Display name + browser <title> source. Comes from `.env` (VITE_APP_NAME). */
  name: env.VITE_APP_NAME,
  /** Short tagline (meta description / landing copy). */
  description: "A wallet your family can help you recover",
  /** App default language — wired into i18n `fallbackLng` (see @/lib/i18n). */
  defaultLocale: "en",
  nav: [
    { labelKey: "nav.home", to: "/" },
    // 🧪 DEMO — remove this entry when you delete the dashboard demo (see README "Gỡ demo").
    { labelKey: "nav.dashboard", to: "/dashboard" },
  ],
} as const;
