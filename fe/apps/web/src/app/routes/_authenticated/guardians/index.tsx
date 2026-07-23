import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardians/")({
  component: GuardiansManageScreen,
});

function GuardiansManageScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("guardians.manage.title")}
      description={t("guardians.manage.description")}
    />
  );
}
