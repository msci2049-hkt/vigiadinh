// 🧪 DEMO FEATURE (features/dashboard) — safe to delete the whole folder. See README "Gỡ demo".

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { useTranslation } from "react-i18next";
import { useDashboardSummary } from "../hooks/use-dashboard";

export function DashboardSummaryCard() {
  const { data, isPending, isError, error } = useDashboardSummary();
  const { t } = useTranslation("dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("summary.title")}</CardTitle>
        <CardDescription>
          {t("summary.descPrefix")} <code>/api/dashboard/summary</code> {t("summary.descSuffix")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? <p className="text-sm text-muted-foreground">{t("summary.loading")}</p> : null}
        {isError ? (
          <p className="text-sm text-destructive">
            {t("summary.error")} {error instanceof Error ? error.message : ""}
          </p>
        ) : null}
        {data ? (
          <div className="space-y-1 text-sm">
            <p>
              {t("summary.notifications")} <span className="font-medium">{data.notifications}</span>
            </p>
            <p className="text-muted-foreground">
              {t("summary.updatedAt", { value: data.updatedAt })}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
