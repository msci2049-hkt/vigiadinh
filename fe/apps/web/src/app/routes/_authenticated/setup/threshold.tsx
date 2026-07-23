import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/threshold")({
  component: SetupThresholdScreen,
});

function SetupThresholdScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("setup.threshold.title")} description={t("setup.threshold.description")} />
  );
}
