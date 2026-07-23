import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardian/approve-warning")({
  component: GuardianApproveWarningScreen,
});

function GuardianApproveWarningScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      tone="alert"
      title={t("guardian.approveWarning.title")}
      description={t("guardian.approveWarning.description")}
      cta={t("guardian.approveWarning.cta")}
      ctaSecondary={t("guardian.approveWarning.ctaSecondary")}
    />
  );
}
