// Nhận tiền (PHA 6) — hiện địa chỉ ví thật để chia sẻ + nút copy. QR để pha
// sau (cần lib QR — không thêm dep vội). Địa chỉ ví CONTRACT không đổi kể cả
// sau khôi phục (audit P0), nên chia sẻ một lần là dùng mãi.
import { Button, Card, CardContent } from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/wallet/receive")({
  component: WalletReceiveScreen,
});

function WalletReceiveScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  const [copied, setCopied] = useState(false);

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("wallet.receive.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("wallet.receive.description")}</p>

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}
      {!isLoading && !isError && !wallet ? (
        <EmptyState message={t("wallet.receive.noWallet")} />
      ) : null}

      {wallet ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="break-all rounded-md bg-muted p-3 font-mono text-foreground text-sm">
              {wallet.stellarAddress}
            </p>
            <Button onClick={() => copy(wallet.stellarAddress)}>
              {copied ? t("wallet.receive.copied") : t("wallet.receive.copyCta")}
            </Button>
            <p className="text-muted-foreground text-xs">{t("wallet.receive.stableNote")}</p>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
