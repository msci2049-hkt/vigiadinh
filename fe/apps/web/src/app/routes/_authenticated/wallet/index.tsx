// Hub ví (PHA 6) — địa chỉ ví thật + lối vào các luồng. Số dư CHƯA có endpoint
// (cần đọc SAC token balance — subsystem riêng, ghi BUILD-LOG); hiện địa chỉ +
// tiles điều hướng. Không tự chế format tiền ở đây (luật §3.7).

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type FamilyIconName, Icon } from "@/components/family/icon";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { invitesOptions } from "@/features/family/api/invites";
import { chainTruthOptions } from "@/features/family/api/recovery";
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
  const { t } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  // Hai câu hỏi người dùng cần trả lời ngay ở hub, đọc từ NGUỒN THẬT:
  // "ví có đang trong cửa sổ bảo vệ không" (chain) và "cứu được chưa" (số
  // người bảo hộ đã lên chain).
  const chain = useQuery({ ...chainTruthOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });

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
              <p className="break-all font-mono text-foreground text-sm leading-relaxed">
                {`${wallet.stellarAddress.slice(0, 6)}…${wallet.stellarAddress.slice(-6)}`}
              </p>
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
