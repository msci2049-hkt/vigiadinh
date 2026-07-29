import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/lib/env";
import { changeAppLanguage } from "@/lib/locale-sync";
import { type FamilyIconName, Icon } from "./icons";
import { cn } from "./utils";

// Export cho màn Cài đặt tái dùng — một danh sách ngôn ngữ, không hai bản chép.
export const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
  { code: "zh", label: "中" },
] as const;

const APP_NAV = [
  { to: "/wallet", key: "fw:wallet.home.title", icon: "wallet", active: ["/wallet"] },
  {
    to: "/guardians",
    key: "fw:setup.chooseGuardians.shortLabel",
    icon: "users",
    active: ["/guardians"],
  },
  {
    to: "/night-watch",
    key: "fw:wallet.home.nightWatchCta",
    icon: "shieldCheck",
    active: ["/night-watch", "/block", "/protecting", "/inheritance"],
  },
  { to: "/settings", key: "fw:settings.title", icon: "settings", active: ["/settings"] },
] as const satisfies ReadonlyArray<{
  to: "/wallet" | "/guardians" | "/night-watch" | "/settings";
  key: string;
  icon: FamilyIconName;
  active: readonly string[];
}>;

/**
 * menu = slot cho tầng app truyền UserMenu vào (C17). ProductShell là
 * components/ nên CẤM tự import features/auth (chiều phụ thuộc một chiều);
 * __root.tsx (tầng app) là nơi ghép.
 */
export function ProductShell({
  children,
  menu,
  layout = "flow",
  showNavigation = false,
}: {
  children: ReactNode;
  menu?: ReactNode;
  layout?: "flow" | "hub";
  showNavigation?: boolean;
}) {
  const { t, i18n } = useTranslation(["common", "fw"]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = i18n.resolvedLanguage ?? "en";
  const isTestnet = env.VITE_STELLAR_NETWORK_PASSPHRASE.startsWith("Test ");

  return (
    <div
      className={cn(
        "product-shell",
        `product-shell--${layout}`,
        showNavigation && "product-shell--with-navigation",
      )}
    >
      <header className="product-shell__chrome">
        <nav className="product-shell__languages" aria-label={t("language.label")}>
          {LANGUAGES.map((language, index) => (
            <span key={language.code} className="flex items-center">
              <button
                type="button"
                className="product-shell__language"
                aria-pressed={active === language.code}
                onClick={() => void changeAppLanguage(language.code)}
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
        <div className="flex items-center gap-3">
          <span className="product-shell__network">
            {isTestnet ? t("network.testnet") : t("network.mainnet")}
          </span>
          {menu}
        </div>
      </header>
      <div className={cn("product-shell__content", `product-shell__content--${layout}`)}>
        {children}
      </div>
      {showNavigation ? (
        <nav className="product-shell__navigation" aria-label={t("nav.home")}>
          {APP_NAV.map((item) => {
            const isActive = item.active.some(
              (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
            );
            return (
              <Link
                key={item.to}
                to={item.to}
                className="product-shell__nav-link"
                aria-current={isActive ? "page" : undefined}
              >
                <Icon name={item.icon} size={20} />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
