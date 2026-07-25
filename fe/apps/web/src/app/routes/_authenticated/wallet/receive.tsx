// Nhận tiền (PHA 6) — hiện địa chỉ ví thật để chia sẻ + nút copy. QR để pha
// sau (cần lib QR — không thêm dep vội). Địa chỉ ví CONTRACT không đổi kể cả
// sau khôi phục (audit P0), nên chia sẻ một lần là dùng mãi.
import { Button, Card, CardContent } from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
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
    <ProductScreen className="justify-center">
      <ScreenHeader
        title={t("wallet.receive.title")}
        description={t("wallet.receive.description")}
      />

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}
      {!isLoading && !isError && !wallet ? (
        <EmptyState message={t("wallet.receive.noWallet")} />
      ) : null}

      {wallet ? (
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col items-center gap-5 pt-6">
            <span className="grid size-32 place-items-center rounded-card border bg-card">
              <Icon name="qrCode" size={32} />
            </span>
            <p className="break-all rounded-card bg-card p-4 font-mono text-foreground text-sm leading-relaxed">
              {`${wallet.stellarAddress.slice(0, 6)}…${wallet.stellarAddress.slice(-6)}`}
            </p>
            <p className="text-muted-foreground text-xs">{t("wallet.receive.stableNote")}</p>
            <PrimaryZone className="w-full">
              <Button onClick={() => copy(wallet.stellarAddress)}>
                <Icon name={copied ? "checkCircle" : "copy"} />
                {copied ? t("wallet.receive.copied") : t("wallet.receive.copyCta")}
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
