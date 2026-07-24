// Hub ví (PHA 6) — địa chỉ ví thật + lối vào các luồng. Số dư CHƯA có endpoint
// (cần đọc SAC token balance — subsystem riêng, ghi BUILD-LOG); hiện địa chỉ +
// tiles điều hướng. Không tự chế format tiền ở đây (luật §3.7).
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/wallet/")({ component: WalletHomeScreen });

function WalletHomeScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("wallet.home.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("wallet.home.description")}</p>

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}
      {!isLoading && !isError && !wallet ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("wallet.home.noWallet")} />
          <Button asChild>
            <Link to="/setup">{t("wallet.home.setupCta")}</Link>
          </Button>
        </div>
      ) : null}

      {wallet ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("wallet.home.addressLabel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all font-mono text-foreground text-sm">{wallet.stellarAddress}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <Link to="/wallet/send">{t("wallet.home.sendCta")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/wallet/receive">{t("wallet.home.receiveCta")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/wallet/history">{t("wallet.home.historyCta")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/night-watch">{t("wallet.home.nightWatchCta")}</Link>
            </Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
