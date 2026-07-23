import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/done")({ component: RecoveryDoneScreen });

function RecoveryDoneScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("recovery.done.title")} description={t("recovery.done.description")} />
  );
}
