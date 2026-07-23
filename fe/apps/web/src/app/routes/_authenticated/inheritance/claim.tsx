import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/inheritance/claim")({
  component: InheritanceClaimScreen,
});

function InheritanceClaimScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("inheritance.claim.title")}
      description={t("inheritance.claim.description")}
    />
  );
}
