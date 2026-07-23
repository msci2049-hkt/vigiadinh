import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/invite")({
  component: SetupInviteScreen,
});

function SetupInviteScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("setup.invite.title")} description={t("setup.invite.description")} />;
}
