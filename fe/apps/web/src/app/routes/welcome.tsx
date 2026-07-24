// Màn mở đầu (PHA 2.5) — public: giới thiệu VíGiaĐình bằng 3 lời hứa NGƯỜI
// THƯỜNG (không jargon) rồi dẫn sang /get-started. "Đã có ví" đi thẳng /passkey.
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/welcome")({ component: WelcomeScreen });

function WelcomeScreen() {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl text-foreground">{t("welcome.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("welcome.description")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {(["welcome.point1", "welcome.point2", "welcome.point3"] as const).map((key) => (
          <li key={key} className="flex gap-3 text-foreground text-sm">
            <span aria-hidden className="text-primary">
              ●
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-col gap-2">
        <Button asChild size="lg">
          <Link to="/get-started">{t("welcome.cta")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/passkey">{t("welcome.haveCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
