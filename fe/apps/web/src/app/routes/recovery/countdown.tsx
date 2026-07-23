import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/countdown")({ component: RecoveryCountdownScreen });

function RecoveryCountdownScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("recovery.countdown.title")}
      description={t("recovery.countdown.description")}
    />
  );
}
