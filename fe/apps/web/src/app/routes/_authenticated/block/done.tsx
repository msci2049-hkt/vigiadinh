import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/block/done")({ component: BlockDoneScreen });

function BlockDoneScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("block.done.title")} description={t("block.done.description")} />;
}
