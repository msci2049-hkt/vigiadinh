import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/waiting")({
  component: NightWatchWaitingScreen,
});

function NightWatchWaitingScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("nightWatch.waiting.title")}
      description={t("nightWatch.waiting.description")}
    />
  );
}
