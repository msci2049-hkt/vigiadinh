import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/choose-guardians")({
  component: SetupChooseGuardiansScreen,
});

function SetupChooseGuardiansScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("setup.chooseGuardians.title")}
      description={t("setup.chooseGuardians.description")}
    />
  );
}
