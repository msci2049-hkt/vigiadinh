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

/** Panel settings + live view of the PANELS registry (which roles see what). */
function AdminSettingsPage() {
  const { t } = useTranslation("admin");

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
            <div key={panel.key} className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-muted px-1.5 py-0.5">{panel.basePath}</code>
              <span className="text-muted-foreground">·</span>
              {panel.roles.map((role) => (
                <Badge key={role} variant="outline">
                  {role}
                </Badge>
              ))}
              <span className="text-muted-foreground text-xs">
                ({panel.nav.length} {t("settings.pages")})
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
