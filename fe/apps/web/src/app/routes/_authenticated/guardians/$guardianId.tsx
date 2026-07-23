import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardians/$guardianId")({
  component: GuardiansDetailScreen,
});

function GuardiansDetailScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("guardians.detail.title")}
      description={t("guardians.detail.description")}
    />
  );
}
