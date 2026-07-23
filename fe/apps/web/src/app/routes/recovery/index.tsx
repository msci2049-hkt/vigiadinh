import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/")({ component: RecoveryStartScreen });

function RecoveryStartScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("recovery.start.title")} description={t("recovery.start.description")} />
  );
}
