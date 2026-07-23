import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/get-started")({ component: GetStartedScreen });

function GetStartedScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("getStarted.title")} description={t("getStarted.description")} />;
}
