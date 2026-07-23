import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/done")({ component: SetupDoneScreen });

function SetupDoneScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("setup.done.title")} description={t("setup.done.description")} />;
}
