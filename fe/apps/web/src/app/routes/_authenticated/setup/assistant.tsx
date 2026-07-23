import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/assistant")({
  component: SetupAssistantScreen,
});

function SetupAssistantScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("setup.assistant.title")} description={t("setup.assistant.description")} />
  );
}
