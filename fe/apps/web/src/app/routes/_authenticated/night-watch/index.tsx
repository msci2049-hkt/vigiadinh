// Trung tâm "người gác đêm" (PHA 6 — cụm ĐỌC): tổng quan an toàn của ví.
// - Có yêu cầu khôi phục ĐANG MỞ → thẻ cảnh báo + đếm ngược CỬA SỔ CHẶN
//   (timelockView PHA 7.1 — hiện CẢ đếm ngược lẫn mốc tuyệt đối) + nút sang /block.
// - Sức khoẻ kết nối người thân: đếm theo bậc (chỉ chủ ví thấy — luật 5).
// Risk score chỉ trì hoãn/báo động — màn này KHÔNG có nút tự huỷ gì (luật 6).
import { timelockView } from "@repo/core";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("nightWatch.center.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("nightWatch.center.description")}</p>

      {loading ? <LoadingRows /> : null}
      {walletError || recovery.isError || guardians.isError ? <ErrorState /> : null}
      {!loading && !walletError && wallet === null ? (
        <EmptyState message={t("nightWatch.noWallet")} />
      ) : null}

      {openRequests.map((req) => {
        const veto = req.vetoUntil ? timelockView(req.vetoUntil, { locale: i18n.language }) : null;
        return (
          <Card key={req.id} className="border-destructive">
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
                <p className="text-muted-foreground text-sm">
                  {t("nightWatch.openRecovery.window", {
                    countdown: veto.countdown,
                    absolute: veto.absolute,
                  })}
                </p>
              ) : null}
              <Button asChild variant="destructive">
                <Link to="/block">{t("nightWatch.openRecovery.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {recovery.isSuccess && openRequests.length === 0 && wallet !== null ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-foreground text-sm">{t("nightWatch.allQuiet")}</p>
          </CardContent>
        </Card>
      ) : null}

      {guardians.isSuccess && wallet !== null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("nightWatch.contacts.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-foreground text-sm">
              {t("nightWatch.contacts.summary", { reachable, quiet, unreachable })}
            </p>
            {quiet + unreachable > 0 ? (
              <Button asChild variant="destructive">
                <Link to="/night-watch/alert">{t("nightWatch.alert.resolveCta")}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/guardians">{t("nightWatch.contacts.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
