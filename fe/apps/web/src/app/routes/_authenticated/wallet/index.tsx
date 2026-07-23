import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/wallet/")({ component: WalletHomeScreen });

function WalletHomeScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("wallet.home.title")} description={t("wallet.home.description")} />;
}
