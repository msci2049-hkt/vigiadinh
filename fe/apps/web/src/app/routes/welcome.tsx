import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/welcome")({ component: WelcomeScreen });

function WelcomeScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("welcome.title")} description={t("welcome.description")} />;
}
