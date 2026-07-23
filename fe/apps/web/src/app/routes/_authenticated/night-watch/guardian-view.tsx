import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/night-watch/guardian-view")({
  component: NightWatchGuardianViewScreen,
});

function NightWatchGuardianViewScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("nightWatch.guardianView.title")}
      description={t("nightWatch.guardianView.description")}
    />
  );
}
