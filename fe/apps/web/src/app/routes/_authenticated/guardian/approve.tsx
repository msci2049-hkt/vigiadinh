import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardian/approve")({
  component: GuardianApproveScreen,
});

function GuardianApproveScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("guardian.approve.title")}
      description={t("guardian.approve.description")}
    />
  );
}
