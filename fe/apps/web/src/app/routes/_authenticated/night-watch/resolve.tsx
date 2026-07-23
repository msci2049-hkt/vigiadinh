import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/resolve")({
  component: NightWatchResolveScreen,
});

function NightWatchResolveScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("nightWatch.resolve.title")}
      description={t("nightWatch.resolve.description")}
    />
  );
}
