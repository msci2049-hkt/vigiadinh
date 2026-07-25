// Trung tâm "người gác đêm" (PHA 6 — cụm ĐỌC): tổng quan an toàn của ví.
// - Có yêu cầu khôi phục ĐANG MỞ → thẻ cảnh báo + đếm ngược CỬA SỔ CHẶN
//   (timelockView PHA 7.1 — hiện CẢ đếm ngược lẫn mốc tuyệt đối) + nút sang /block.
// - Sức khoẻ kết nối người thân: đếm theo bậc (chỉ chủ ví thấy — luật 5).
// Risk score chỉ trì hoãn/báo động — màn này KHÔNG có nút tự huỷ gì (luật 6).
import { timelockView } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { TimelockCountdown } from "@/components/family/timelock-countdown";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { guardiansOptions } from "@/features/family/api/guardians";
import { recoveryOptions } from "@/features/family/api/recovery";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/night-watch/")({
  component: NightWatchCenterScreen,
});

function NightWatchCenterScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const recovery = useQuery({
    ...recoveryOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const openRequests = (recovery.data ?? []).filter(
    (r) => r.status === "pending" || r.status === "ready",
  );
  const active = (guardians.data ?? []).filter((g) => g.status !== "removed");
  const reachable = active.filter((g) => g.status === "active").length;
  const quiet = active.filter((g) => g.status === "slow").length;
  const unreachable = active.filter((g) => g.status === "offline").length;
  const loading = walletLoading || recovery.isLoading || guardians.isLoading;

  return (
    <ProductScreen>
      <span className="grid size-14 place-items-center rounded-full bg-primary">
        <Icon name="moon" size={32} />
      </span>
      <ScreenHeader
        title={t("nightWatch.center.title")}
        description={t("nightWatch.center.description")}
      />

      {loading ? <LoadingRows /> : null}
      {walletError || recovery.isError || guardians.isError ? <ErrorState /> : null}
      {!loading && !walletError && wallet === null ? (
        <EmptyState message={t("nightWatch.noWallet")} />
      ) : null}

      {openRequests.map((req) => {
        const veto = req.vetoUntil ? timelockView(req.vetoUntil, { locale: i18n.language }) : null;
        return (
          <Card key={req.id} className="border-destructive bg-paper-2">
            <CardHeader>
              <CardTitle className="text-destructive text-lg">
                {t("nightWatch.openRecovery.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-foreground text-sm">
                {t("nightWatch.openRecovery.body", {
                  approvals: req.approvals,
                  threshold: req.threshold ?? 0,
                })}
              </p>
              {veto && !veto.expired ? (
                <TimelockCountdown countdown={veto.countdown} absolute={veto.absolute} />
              ) : null}
              <PrimaryZone>
                <Button asChild variant="danger">
                  <Link to="/block">{t("nightWatch.openRecovery.cta")}</Link>
                </Button>
              </PrimaryZone>
            </CardContent>
          </Card>
        );
      })}

      {recovery.isSuccess && openRequests.length === 0 && wallet !== null ? (
        <ErrorBanner type="info" title={t("nightWatch.allQuiet")} />
      ) : null}

      {guardians.isSuccess && wallet !== null ? (
        <Card className="bg-paper-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("nightWatch.contacts.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-foreground text-sm">
              {t("nightWatch.contacts.summary", { reachable, quiet, unreachable })}
            </p>
            {quiet + unreachable > 0 ? (
              <Button asChild variant="secondary">
                <Link to="/night-watch/alert">{t("nightWatch.alert.resolveCta")}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/guardians">{t("nightWatch.contacts.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
