import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/inheritance/")({
  component: InheritanceSetupScreen,
});

function InheritanceSetupScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("inheritance.setup.title")}
      description={t("inheritance.setup.description")}
    />
  );
}
