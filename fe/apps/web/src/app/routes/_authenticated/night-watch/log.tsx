import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/log")({
  component: NightWatchLogScreen,
});

function NightWatchLogScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("nightWatch.log.title")} description={t("nightWatch.log.description")} />
  );
}
