import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/")({
  component: NightWatchCenterScreen,
});

function NightWatchCenterScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("nightWatch.center.title")}
      description={t("nightWatch.center.description")}
    />
  );
}
