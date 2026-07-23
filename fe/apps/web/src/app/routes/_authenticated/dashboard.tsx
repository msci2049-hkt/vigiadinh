// 🧪 DEMO ROUTE — protected-route + dashboard/SSE showcase. Safe to delete this file
// with features/dashboard (see README "Gỡ demo"). Auth is enforced by the
// _authenticated layout guard (session in router context).
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { DashboardSummaryCard } from "@/features/dashboard/components/dashboard-summary-card";
import { EventsFeed } from "@/features/dashboard/components/events-feed";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useCurrentUser();
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("protectedNote")} <code>/login</code>
          {user ? t("greeting", { name: user.name ?? user.email }) : t("noUser")}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <DashboardSummaryCard />
        <EventsFeed />
      </div>
    </div>
  );
}
