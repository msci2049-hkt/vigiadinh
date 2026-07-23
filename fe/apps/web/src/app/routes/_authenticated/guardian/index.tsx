import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/guardian/")({
  component: GuardianInboxScreen,
});

function GuardianInboxScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("guardian.inbox.title")} description={t("guardian.inbox.description")} />
  );
}
