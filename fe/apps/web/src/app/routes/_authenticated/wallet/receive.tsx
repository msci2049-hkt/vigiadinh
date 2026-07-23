import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/wallet/receive")({
  component: WalletReceiveScreen,
});

function WalletReceiveScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("wallet.receive.title")} description={t("wallet.receive.description")} />
  );
}
