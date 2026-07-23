import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/sent")({ component: RecoverySentScreen });

function RecoverySentScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("recovery.sent.title")} description={t("recovery.sent.description")} />
  );
}
