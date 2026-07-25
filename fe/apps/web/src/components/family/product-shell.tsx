import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/lib/env";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
  { code: "zh", label: "中" },
] as const;

export function ProductShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation("common");
  const active = i18n.resolvedLanguage ?? "en";
  const isTestnet = env.VITE_STELLAR_NETWORK_PASSPHRASE.startsWith("Test ");

  return (
    <div className="product-shell">
      <header className="relative z-20 mx-auto flex w-full max-w-md items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <nav className="flex min-h-11 items-center" aria-label={t("language.label")}>
          {LANGUAGES.map((language, index) => (
            <span key={language.code} className="flex items-center">
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-full px-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground aria-pressed:text-foreground"
                aria-pressed={active === language.code}
                onClick={() => void i18n.changeLanguage(language.code)}
              >
                {language.label}
              </button>
              {index < LANGUAGES.length - 1 ? (
                <span aria-hidden className="text-border">
                  ·
                </span>
              ) : null}
            </span>
          ))}
        </nav>
        <span className="rounded-full bg-muted px-4 py-2 font-medium text-muted-foreground text-sm">
          {isTestnet ? t("network.testnet") : t("network.mainnet")}
        </span>
      </header>
      <div className="relative z-10 mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
