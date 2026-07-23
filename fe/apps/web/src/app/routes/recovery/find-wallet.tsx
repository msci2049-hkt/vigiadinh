import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/recovery/find-wallet")({
  component: RecoveryFindWalletScreen,
});

function RecoveryFindWalletScreen() {
  const { t } = useTranslation("fw");
  return (
    <ScreenStub
      title={t("recovery.findWallet.title")}
      description={t("recovery.findWallet.description")}
    />
  );
}
