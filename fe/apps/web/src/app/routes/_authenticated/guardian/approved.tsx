import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardian/approved")({
  component: GuardianApprovedScreen,
});

function GuardianApprovedScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("guardian.approved.title")}
      description={t("guardian.approved.description")}
    />
  );
}
