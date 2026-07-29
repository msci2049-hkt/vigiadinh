// Nhận tiền (PHA 6 + LÔ 4 29/07) — QR + sao chép + TẢI ẢNH + CHIA SẺ ẢNH.
// Ảnh dùng CHUNG renderer thiệp lời mời (features/family/lib/invite-image):
// QR + tên chủ ví + dòng "Địa chỉ ví trên Mạng thử Stellar". CỐ Ý KHÔNG in
// địa chỉ dạng chữ dài lên ảnh — ảnh dễ bị chuyển tiếp nhầm nhóm, QR đã chứa
// đủ. Chia sẻ qua navigator.share({files}) gate bằng canShare — không hỗ trợ
// thì ẨN nút, không vẽ nút chết. Địa chỉ ví CONTRACT không đổi kể cả sau
// khôi phục (audit P0), nên chia sẻ một lần là dùng mãi.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { WalletQrCode } from "@/components/family/illustrations";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { renderInviteCardPng, slugifyLabel } from "@/features/family/lib/invite-image";

export const Route = createFileRoute("/_authenticated/wallet/receive")({
  component: WalletReceiveScreen,
});

function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

function WalletReceiveScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  const { user } = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const ownerName = user?.name?.trim() ? user.name : t("wallet.receive.unnamedOwner");

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function renderPng(address: string): Promise<Blob> {
    // QR chứa THẲNG địa chỉ (cùng nội dung WalletQrCode trên màn) — ví khác
    // quét là điền được ngay.
    return renderInviteCardPng({
      url: address,
      label: ownerName,
      title: t("wallet.receive.image.title"),
      subtitle: t("wallet.receive.image.subtitle"),
    });
  }

  async function downloadPng(address: string) {
    setImageBusy(true);
    setImageFailed(false);
    try {
      const blob = await renderPng(address);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dia-chi-vi-${slugifyLabel(ownerName)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImageFailed(true);
    } finally {
      setImageBusy(false);
    }
  }

  async function sharePng(address: string) {
    setImageBusy(true);
    setImageFailed(false);
    try {
      const blob = await renderPng(address);
      const file = new File([blob], `dia-chi-vi-${slugifyLabel(ownerName)}.png`, {
        type: "image/png",
      });
      await navigator.share({ files: [file] });
    } catch (err) {
      // Người dùng đóng share sheet (AbortError) KHÔNG phải lỗi.
      if (!(err instanceof DOMException && err.name === "AbortError")) setImageFailed(true);
    } finally {
      setImageBusy(false);
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
            <div className="rounded-card border bg-white p-3 shadow-sm">
              <WalletQrCode value={wallet.stellarAddress} label={t("wallet.receive.qrLabel")} />
            </div>
            <p className="break-all rounded-card bg-card p-4 font-mono text-foreground text-sm leading-relaxed">
              {`${wallet.stellarAddress.slice(0, 6)}…${wallet.stellarAddress.slice(-6)}`}
            </p>
            <p className="text-muted-foreground text-xs">{t("wallet.receive.stableNote")}</p>
            {imageFailed ? (
              <p className="text-destructive text-xs" role="alert">
                {t("wallet.receive.imageFailed")}
              </p>
            ) : null}
            <PrimaryZone className="w-full">
              <Button onClick={() => copy(wallet.stellarAddress)}>
                <Icon name={copied ? "checkCircle" : "copy"} />
                {copied ? t("wallet.receive.copied") : t("wallet.receive.copyCta")}
              </Button>
              <Button
                variant="secondary"
                loading={imageBusy}
                onClick={() => void downloadPng(wallet.stellarAddress)}
                data-testid="receive-download-png"
              >
                <Icon name="qrCode" />
                {t("wallet.receive.downloadCta")}
              </Button>
              {canShareFiles() ? (
                <Button
                  variant="secondary"
                  loading={imageBusy}
                  onClick={() => void sharePng(wallet.stellarAddress)}
                  data-testid="receive-share-png"
                >
                  {t("wallet.receive.shareCta")}
                </Button>
              ) : null}
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
