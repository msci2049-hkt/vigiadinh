import { panelByKey, panelsForRole } from "@repo/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator } from "@repo/ui";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CommandMenu } from "@/components/command-menu";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

/**
 * Generic role-panel shell driven by the PANELS registry (@repo/auth):
 * sidebar = panel.nav, header = breadcrumb + Cmd+K + panel switcher (only when
 * the user's role can enter >1 panel). Adding a panel never touches this file.
 */
export function PanelShell({ panelKey }: { panelKey: string }) {
  const { t } = useTranslation("common");
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const panel = panelByKey(panelKey);
  if (!panel) throw new Error(`PanelShell: unknown panel "${panelKey}" — check PANELS registry`);

  const switchablePanels = panelsForRole(user?.role);
  const activeNav = [...panel.nav].reverse().find((item) => pathname.startsWith(item.to));

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Sidebar (top bar on mobile) */}
      <aside className="md:w-52 md:shrink-0">
        <nav
          aria-label={t(panel.labelKey, { defaultValue: panel.labelKey })}
          className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
        >
          {panel.nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === panel.basePath }}
              className="whitespace-nowrap rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:font-medium [&.active]:text-accent-foreground"
            >
              {t(item.labelKey, { defaultValue: item.labelKey })}
            </Link>
          ))}
        </nav>
        {switchablePanels.length > 1 ? (
          <div className="mt-4 hidden md:block">
            <Separator className="mb-3" />
            <Select
              value={panel.key}
              onValueChange={(key) => {
                const next = panelByKey(key);
                if (next) void navigate({ to: next.basePath });
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-label={t("panelShell.switch")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {switchablePanels.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {t(p.labelKey, { defaultValue: p.labelKey })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </aside>

      {/* Content + breadcrumb header */}
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <nav aria-label="breadcrumb" className="text-muted-foreground text-sm">
            <span>{t(panel.labelKey, { defaultValue: panel.labelKey })}</span>
            {activeNav && activeNav.to !== panel.basePath ? (
              <>
                <span className="mx-1">/</span>
                <span className="text-foreground">
                  {t(activeNav.labelKey, { defaultValue: activeNav.labelKey })}
                </span>
              </>
            ) : null}
          </nav>
          <CommandMenu panel={panel} />
        </div>
        <Outlet />
      </section>
    </div>
  );
}
