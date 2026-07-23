import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/alert")({
  component: NightWatchAlertScreen,
});

function NightWatchAlertScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      tone="alert"
      title={t("nightWatch.alert.title")}
      description={t("nightWatch.alert.description")}
      cta={t("nightWatch.alert.cta")}
    />
  );
}
