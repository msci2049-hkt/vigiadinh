// Bước wizard mức B — stub NHÃN ĐÚNG (trao đổi khoá đa bên chưa dựng; lối ra về
// mức A đang chạy). Xem features/family/components/wizard-step.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WizardStep } from "@/features/family/components/wizard-step";

export const Route = createFileRoute("/_authenticated/setup/assistant")({
  component: SetupAssistantScreen,
});

function SetupAssistantScreen() {
  const { t } = useTranslation("fw");
  return (
    <WizardStep title={t("setup.assistant.title")} description={t("setup.assistant.description")} />
  );
}
