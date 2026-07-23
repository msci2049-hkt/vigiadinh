import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/block/confirm")({
  component: BlockConfirmScreen,
});

function BlockConfirmScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("block.confirm.title")} description={t("block.confirm.description")} />
  );
}
