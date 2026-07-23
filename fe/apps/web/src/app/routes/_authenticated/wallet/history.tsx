import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/wallet/history")({
  component: WalletHistoryScreen,
});

function WalletHistoryScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub title={t("wallet.history.title")} description={t("wallet.history.description")} />
  );
}
