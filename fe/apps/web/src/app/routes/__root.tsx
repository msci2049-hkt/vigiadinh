import * as Sentry from "@sentry/react";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ProductShell } from "@/components/family/product-shell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/config/site";
import { ImpersonationBanner } from "@/features/auth/components/impersonation-banner";
import { UserMenu } from "@/features/auth/components/user-menu";
import { useGuardianWorkBadge } from "@/features/family/hooks/use-guardian-work-badge";
import { env } from "@/lib/env";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  // App-wide fallbacks so a route error / unknown path never blanks the screen.
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootLayout() {
  const { i18n } = useTranslation("common");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Badge tab Người thân (B2 lô 30/07): số việc đang chờ người bảo hộ này
  // duyệt. enabled CHỈ trên hub path (đã qua cổng đăng nhập) — đường public
  // không bắn query; SSE invalidate nguồn nên số sống realtime.
  const guardianTabBadge = useGuardianWorkBadge(showsAppNavigation(pathname));
  // Đồng bộ <html lang> theo ngôn ngữ hiện tại (a11y + hreflang cho SPA): screen
  // reader đọc đúng giọng, và trình duyệt chọn đúng font CJK khi lang="zh".
  useEffect(() => {
    const lang = i18n.resolvedLanguage ?? "en";
    document.documentElement.lang = lang;
  }, [i18n.resolvedLanguage]);
  if (isProductPath(pathname)) {
    const authPath = isAuthPath(pathname);
    const hubPath = isHubPath(pathname);
    return (
      <ProductShell
        menu={showsAccountMenu(pathname) ? <UserMenu compact /> : undefined}
        layout={hubPath ? "hub" : "flow"}
        showNavigation={showsAppNavigation(pathname)}
        guardianTabBadge={guardianTabBadge}
      >
        {authPath ? (
          <main className="product-screen auth-screen">
            <Link to="/welcome" className="auth-screen__brand">
              {site.name}
            </Link>
            <Outlet />
          </main>
        ) : (
          <Outlet />
        )}
        {env.VITE_ENABLE_DEVTOOLS ? <TanStackRouterDevtools position="bottom-right" /> : null}
      </ProductShell>
    );
  }
  return (
    <div className="workspace-shell">
      {/* Fixed warning while an admin is impersonating (session.impersonatedBy). */}
      <ImpersonationBanner />
      <header className="workspace-shell__header">
        <div className="workspace-shell__chrome">
          <nav className="flex items-center gap-4">
            <Link to="/" className="workspace-shell__brand">
              {site.name}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu compact />
          </div>
        </div>
      </header>
      <main className="workspace-shell__content">
        <Outlet />
      </main>
      {env.VITE_ENABLE_DEVTOOLS ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </div>
  );
}

function isProductPath(pathname: string): boolean {
  return [
    "/welcome",
    "/get-started",
    "/passkey",
    "/recovery",
    "/setup",
    "/wallet",
    "/guardians",
    "/guardian",
    "/block",
    "/night-watch",
    "/inheritance",
    "/settings",
    "/protecting",
    "/login",
    "/sign-up",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/unauthorized",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string): boolean {
  return [
    "/login",
    "/sign-up",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/unauthorized",
  ].includes(pathname);
}

function isHubPath(pathname: string): boolean {
  return [
    "/wallet",
    "/wallet/history",
    "/guardians",
    "/night-watch",
    "/night-watch/log",
    "/inheritance",
    "/settings",
    "/protecting",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function showsAppNavigation(pathname: string): boolean {
  return [
    "/wallet",
    "/wallet/history",
    "/guardians",
    "/night-watch",
    "/night-watch/log",
    "/inheritance",
    "/settings",
    "/protecting",
  ].includes(pathname);
}

function showsAccountMenu(pathname: string): boolean {
  return [
    "/setup",
    "/wallet",
    "/guardians",
    "/guardian",
    "/block",
    "/night-watch",
    "/inheritance",
    "/settings",
    "/protecting",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function CenteredMessage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <ProductShell layout="flow">
      <main className="product-screen justify-center text-center">
        <div className="state-illustration" aria-hidden>
          !
        </div>
        <h1 className="product-title">{title}</h1>
        <div className="product-copy mx-auto">{children}</div>
        <Link to="/" className="fw-button fw-button--primary fw-button--default">
          {t("backHome")}
        </Link>
      </main>
    </ProductShell>
  );
}

function NotFoundComponent() {
  const { t } = useTranslation("errors");
  return <CenteredMessage title={t("notFound.title")}>{t("notFound.description")}</CenteredMessage>;
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  const { t } = useTranslation("errors");
  // React prod NUỐT lỗi routing/render sau khi boundary bắt — phải tự báo
  // Sentry ở đây, nếu không lỗi chỉ hiện fallback UI và biến mất không dấu vết.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  // Don't leak internal error details in production.
  return (
    <CenteredMessage title={t("boundary.title")}>
      {import.meta.env.DEV ? error.message : t("boundary.fallback")}
    </CenteredMessage>
  );
}
