import * as Sentry from "@sentry/react";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/config/site";
import { ImpersonationBanner } from "@/features/auth/components/impersonation-banner";
import { UserMenu } from "@/features/auth/components/user-menu";
import { env } from "@/lib/env";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  // App-wide fallbacks so a route error / unknown path never blanks the screen.
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootLayout() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed warning while an admin is impersonating (session.impersonatedBy). */}
      <ImpersonationBanner />
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-4">
            <Link to="/" className="font-semibold">
              {site.name}
            </Link>
            {site.nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground text-sm [&.active]:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      {env.VITE_ENABLE_DEVTOOLS ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </div>
  );
}

function CenteredMessage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
      <div className="text-muted-foreground text-sm">{children}</div>
      <Link to="/" className="inline-block text-primary text-sm underline-offset-4 hover:underline">
        {t("backHome")}
      </Link>
    </div>
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
