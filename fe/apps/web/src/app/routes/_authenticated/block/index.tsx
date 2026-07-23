import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/block/")({ component: BlockAlertScreen });

function BlockAlertScreen() {
  const { t } = useTranslation("fw");
  // Luật veto: MỘT hành động duy nhất — không có ctaSecondary ở màn này.
  return (
    <ScreenStub
      tone="alert"
      title={t("block.alert.title")}
      description={t("block.alert.description")}
      cta={t("block.alert.cta")}
    />
  );
}
