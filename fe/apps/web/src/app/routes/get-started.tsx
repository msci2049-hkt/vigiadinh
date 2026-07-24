// Ngã ba mở đầu (PHA 2.5) — public: tạo ví mới (cần phiên app để mirror ví →
// /sign-up rồi /setup) HOẶC mở ví đã có trên máy này (/passkey — connect + đăng
// nhập SEP-45, không cần email).
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/get-started")({ component: GetStartedScreen });

function GetStartedScreen() {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("getStarted.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("getStarted.description")}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("getStarted.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("getStarted.createBody")}</p>
          <Button asChild>
            <Link to="/sign-up">{t("getStarted.createCta")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("getStarted.haveTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("getStarted.haveBody")}</p>
          <Button asChild variant="outline">
            <Link to="/passkey">{t("getStarted.haveCta")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
