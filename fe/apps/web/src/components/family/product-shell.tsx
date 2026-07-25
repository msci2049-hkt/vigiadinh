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
      <header className="product-shell__chrome">
        <nav className="product-shell__languages" aria-label={t("language.label")}>
          {LANGUAGES.map((language, index) => (
            <span key={language.code} className="flex items-center">
              <button
                type="button"
                className="product-shell__language"
                aria-pressed={active === language.code}
                onClick={() => void i18n.changeLanguage(language.code)}
              >
                {language.label}
              </button>
              {index < LANGUAGES.length - 1 ? (
                <span aria-hidden className="product-shell__language-separator">
                  ·
                </span>
              ) : null}
            </span>
          ))}
        </nav>
        <span className="product-shell__network">
          {isTestnet ? t("network.testnet") : t("network.mainnet")}
        </span>
      </header>
      <div className="product-shell__content">{children}</div>
    </div>
  );
}
