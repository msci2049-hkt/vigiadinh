import { Button, Card, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { site } from "@/config/site";
// 🧪 DEMO — live BE health badge; delete this import + its usage with the demo (README "Gỡ demo").
import { HealthBadge } from "@/features/health/components/health-badge";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const STACK = ["router", "query", "auth", "sse", "styling", "forms"] as const;

function HomePage() {
  const { t } = useTranslation("common");
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-bold text-3xl tracking-tight">{site.name}</h1>
          {/* 🧪 DEMO — live BE status; remove with the demo. */}
          <HealthBadge />
        </div>
        <p className="max-w-2xl text-muted-foreground">{t("home.description")}</p>
        <div className="flex flex-wrap gap-3">
          {/* 🧪 DEMO — CTA to the protected dashboard demo; remove with the demo. */}
          <Button asChild>
            <Link to="/dashboard">{t("home.ctaDashboard")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">{t("home.ctaLogin")}</Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STACK.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{t(`home.stack.${key}.title`)}</CardTitle>
              <CardDescription>{t(`home.stack.${key}.desc`)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
