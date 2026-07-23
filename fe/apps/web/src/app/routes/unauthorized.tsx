import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";

// 403 — signed in but the role doesn't grant this panel (see requireRoles).
// `redirect` keeps the attempted URL for display/debug; `reason` is a code.
const unauthorizedSearchSchema = z.object({
  redirect: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/unauthorized")({
  validateSearch: unauthorizedSearchSchema,
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const { redirect } = Route.useSearch();
  const { t } = useTranslation("errors");

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-bold text-2xl tracking-tight">{t("unauthorized.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("unauthorized.description")}</p>
      {redirect ? (
        <p className="text-muted-foreground text-xs">
          {t("unauthorized.attempted")} <code className="rounded bg-muted px-1">{redirect}</code>
        </p>
      ) : null}
      <Button asChild variant="outline">
        <Link to="/">{t("unauthorized.backHome")}</Link>
      </Button>
    </div>
  );
}
