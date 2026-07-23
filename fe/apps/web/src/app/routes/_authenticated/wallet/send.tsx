import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/wallet/send")({
  component: WalletSendScreen,
});

function WalletSendScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("wallet.send.title")} description={t("wallet.send.description")} />;
}
