import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { adminUsersQueryOptions } from "@/features/users-management";

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  component: AdminOverviewPage,
});

/** Panel landing: user counts + shortcuts. Data = the same listUsers endpoint. */
function AdminOverviewPage() {
  const { t } = useTranslation("admin");
  // total: 1-row page is enough — we only need `total` from the BE.
  const totals = useQuery(adminUsersQueryOptions({ limit: 1, offset: 0 }));
  const banned = useQuery(
    adminUsersQueryOptions({
      limit: 1,
      offset: 0,
      filterField: "banned",
      filterValue: true,
      filterOperator: "eq",
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">{t("overview.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("overview.description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("overview.totalUsers")}
          value={totals.data?.total}
          isPending={totals.isPending}
        />
        <StatCard
          label={t("overview.bannedUsers")}
          value={banned.data?.total}
          isPending={banned.isPending}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("overview.quickLinksTitle")}</CardTitle>
          <CardDescription>{t("overview.quickLinksDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link to="/admin/users" className="text-primary underline-offset-4 hover:underline">
            → {t("nav.users")}
          </Link>
          <Link to="/admin/sessions" className="text-primary underline-offset-4 hover:underline">
            → {t("nav.sessions")}
          </Link>
          <Link to="/admin/settings" className="text-primary underline-offset-4 hover:underline">
            → {t("nav.settings")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  isPending,
}: {
  label: string;
  value: number | undefined;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {isPending ? <Skeleton className="h-9 w-16" /> : (value ?? "—")}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
