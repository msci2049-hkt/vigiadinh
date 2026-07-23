import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/inheritance/heartbeat")({
  component: InheritanceHeartbeatScreen,
});

function InheritanceHeartbeatScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("inheritance.heartbeat.title")}
      description={t("inheritance.heartbeat.description")}
    />
  );
}
