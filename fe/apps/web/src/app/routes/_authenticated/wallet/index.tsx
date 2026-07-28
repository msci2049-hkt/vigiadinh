// Hub ví (PHA 6) — số dư thật (GET /api/wallets/:id/balance, audit §8) + địa
// chỉ ví + lối vào các luồng. Tiền format qua formatAmount của @repo/core
// (stroops → XLM, BigInt-safe) — không tự chế format tiền ở đây (luật §3.7).

import { formatAmount } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type FamilyIconName, Icon } from "@/components/family/icons";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/family/ui";
import { invitesOptions } from "@/features/family/api/invites";
import { chainTruthOptions } from "@/features/family/api/recovery";
import { walletBalanceOptions } from "@/features/family/api/wallets";
import { CooldownNotice } from "@/features/family/components/cooldown-notice";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/wallet/")({ component: WalletHomeScreen });

function WalletLink({
  to,
  icon,
  children,
  primary = false,
}: {
  to: "/wallet/send" | "/wallet/receive" | "/wallet/history" | "/night-watch";
  icon: FamilyIconName;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "flex min-h-16 items-center gap-3 rounded-card bg-primary px-5 font-bold text-primary-foreground shadow-[var(--shadow-button)] transition-transform hover:-translate-y-px"
          : "flex min-h-16 items-center gap-3 rounded-card border bg-card px-5 font-semibold text-foreground shadow-sm transition-transform hover:-translate-y-px"
      }
    >
      <Icon name={icon} />
      <span>{children}</span>
    </Link>
  );
}

function WalletHomeScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  // Hai câu hỏi người dùng cần trả lời ngay ở hub, đọc từ NGUỒN THẬT:
  // "ví có đang trong cửa sổ bảo vệ không" (chain) và "cứu được chưa" (số
  // người bảo hộ đã lên chain).
  const chain = useQuery({ ...chainTruthOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const balance = useQuery({ ...walletBalanceOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const [copied, setCopied] = useState(false);

  async function copyAddress(address: string) {
    // Clipboard nhận địa chỉ ĐẦY ĐỦ — màn hình vẫn hiện rút gọn (bug Q18: trước
    // đây không có đường nào lấy được chuỗi đầy đủ ngoài QR).
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("wallet.home.title")}
        description={t("wallet.home.description")}
        display
      />

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      {chain.data ? <CooldownNotice cooldown={chain.data.cooldown} /> : null}
      {invites.data ? <RecoverabilityBanner value={invites.data.recoverability} /> : null}
      {/* Cảnh báo mà không có lối đi = dead-end (bug M2): người thoát wizard
          giữa chừng phải quay lại được luồng mời từ chính hub. */}
      {wallet && invites.data && !invites.data.recoverability.recoverable ? (
        <Button asChild>
          <Link to="/setup/choose-guardians">{t("wallet.home.inviteCta")}</Link>
        </Button>
      ) : null}
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
              <CardTitle className="text-sm">{t("wallet.home.balanceLabel")}</CardTitle>
            </CardHeader>
            <CardContent>
              {balance.isPending ? <Skeleton className="h-9 w-40" /> : null}
              {balance.data ? (
                // Hiện CẢ khi = 0 ("0 XLM") — số dư trắng là lỗ hổng dễ thấy
                // nhất trước giám khảo, không phải "chưa có gì để hiện".
                <p className="font-bold text-3xl text-foreground tracking-tight">
                  {formatAmount(balance.data.balance, { locale: i18n.language, code: "XLM" })}
                </p>
              ) : null}
              {balance.isError ? (
                // Lỗi đọc không được giấu thành màn trắng: hiện "—" + thử lại.
                <div className="flex items-center gap-3">
                  <p className="font-bold text-3xl text-muted-foreground">—</p>
                  <Button variant="ghost" size="sm" onClick={() => void balance.refetch()}>
                    {t("wallet.home.balanceRetry")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("wallet.home.addressLabel")}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="break-all font-mono text-foreground text-sm leading-relaxed">
                {`${wallet.stellarAddress.slice(0, 6)}…${wallet.stellarAddress.slice(-6)}`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyAddress(wallet.stellarAddress)}
              >
                <Icon name={copied ? "checkCircle" : "copy"} />
                {copied ? t("wallet.receive.copied") : t("wallet.receive.copyCta")}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <WalletLink to="/wallet/send" icon="send" primary>
              {t("wallet.home.sendCta")}
            </WalletLink>
            <WalletLink to="/wallet/receive" icon="qrCode">
              {t("wallet.home.receiveCta")}
            </WalletLink>
            <WalletLink to="/wallet/history" icon="history">
              {t("wallet.home.historyCta")}
            </WalletLink>
            <WalletLink to="/night-watch" icon="moon">
              {t("wallet.home.nightWatchCta")}
            </WalletLink>
          </div>
        </>
      ) : null}
    </ProductScreen>
  );
}
