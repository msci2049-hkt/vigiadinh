import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/progress")({ component: RecoveryProgressScreen });

function RecoveryProgressScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("recovery.progress.title")}
      description={t("recovery.progress.description")}
    />
  );
}
