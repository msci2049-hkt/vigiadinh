import { PANELS } from "@repo/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/family/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated/_admin/admin/settings")({
  component: AdminSettingsPage,
});

type CommonPanelKey =
  | "panels.admin.label"
  | "panels.admin.nav.overview"
  | "panels.admin.nav.users"
  | "panels.admin.nav.sessions"
  | "panels.admin.nav.settings";

/** Panel settings + live view of the PANELS registry (which roles see what). */
function AdminSettingsPage() {
  const { t } = useTranslation(["admin", "common"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("settings.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.appearanceTitle")}</CardTitle>
          <CardDescription>{t("settings.appearanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.registryTitle")}</CardTitle>
          <CardDescription>{t("settings.registryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PANELS.map((panel) => (
            <div key={panel.key} className="rounded-card border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-sm">
                  {t(panel.labelKey as CommonPanelKey, { ns: "common" })}
                </p>
                <Badge variant="outline">
                  {panel.nav.length} {t("settings.pages")}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {panel.nav.map((item) => (
                  <Badge key={item.to} variant="secondary">
                    {t(item.labelKey as CommonPanelKey, { ns: "common" })}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
