import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/")({ component: SetupIntroScreen });

function SetupIntroScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("setup.intro.title")} description={t("setup.intro.description")} />;
}
