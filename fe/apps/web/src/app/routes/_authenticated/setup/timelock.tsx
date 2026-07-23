import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/timelock")({
  component: SetupTimelockScreen,
});

function SetupTimelockScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("setup.timelock.title")} description={t("setup.timelock.description")} />
  );
}
