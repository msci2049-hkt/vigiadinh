// Màn CẢNH BÁO chặn khôi phục (PHA 6 — cụm GHI, luồng veto đi đầu).
// Luật veto: MỘT hành động duy nhất, không nút phụ. Hiện fingerprint KHOÁ MỚI
// mà yêu cầu khôi phục đề cử (mirror indexer) — người dùng thấy ĐÚNG thứ sắp
// bị chặn, cùng lớp chống-ký-mù với màn ký (ghi chú audit P0 trong BUILD-LOG).
import { timelockView } from "@repo/core";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { recoveryOptions } from "@/features/family/api/recovery";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/block/")({ component: BlockAlertScreen });

function BlockAlertScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const recovery = useQuery({
    ...recoveryOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const open = (recovery.data ?? []).find((r) => r.status === "pending" || r.status === "ready");
  const loading = walletLoading || recovery.isLoading;
  const veto = open?.vetoUntil ? timelockView(open.vetoUntil, { locale: i18n.language }) : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-destructive">{t("block.alert.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("block.alert.description")}</p>

      {loading ? <LoadingRows /> : null}
      {walletError || recovery.isError ? <ErrorState /> : null}

      {!loading && !walletError && !recovery.isError && !open ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("block.alert.nothingOpen")} />
          <Button asChild variant="outline">
            <Link to="/night-watch">{t("block.alert.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {open ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg">{t("block.alert.requestTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-foreground text-sm">
              {t("block.alert.requestBody", {
                approvals: open.approvals,
                threshold: open.threshold ?? 0,
              })}
            </p>
            <p className="break-all font-mono text-muted-foreground text-xs">
              {t("block.alert.fingerprintLabel", { fingerprint: open.newOwner })}
            </p>
            {veto && !veto.expired ? (
              <p className="text-muted-foreground text-sm">
                {t("block.alert.window", { countdown: veto.countdown, absolute: veto.absolute })}
              </p>
            ) : null}
            <Button asChild variant="destructive">
              <Link to="/block/confirm">{t("block.alert.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
