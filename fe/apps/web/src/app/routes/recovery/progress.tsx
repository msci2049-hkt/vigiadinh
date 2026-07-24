// Bước 3: tiến độ khôi phục (PUBLIC, poll 30s — dữ liệu vốn public on-chain).
// Mỗi trạng thái một câu chữ người thường + đường đi kế: chờ phiếu → cửa sổ
// chờ (countdown) → xong (done) → hoặc đã bị chặn.
import { Button } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { publicProgressOptions } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/progress")({
  validateSearch: z.object({
    address: z
      .string()
      .regex(/^C[A-Z2-7]{55}$/)
      .catch(""),
  }),
  component: RecoveryProgressScreen,
});

function RecoveryProgressScreen() {
  const { t } = useTranslation("fw");
  const { address } = Route.useSearch();
  const progress = useQuery({ ...publicProgressOptions(address), enabled: address !== "" });
  const status = progress.data?.status ?? "none";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.progress.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.progress.description")}</p>

      {address === "" ? (
        <Button asChild variant="outline">
          <Link to="/recovery/find-wallet">{t("recovery.progress.missingAddressCta")}</Link>
        </Button>
      ) : null}
      {progress.isLoading ? <LoadingRows /> : null}
      {progress.isError ? <ErrorState /> : null}

      {progress.data ? (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          {status === "none" ? (
            <p className="text-foreground text-sm">{t("recovery.progress.state.none")}</p>
          ) : null}
          {status === "pending" ? (
            <>
              <p className="text-foreground text-sm">{t("recovery.progress.state.pending")}</p>
              <p className="text-muted-foreground text-sm">
                {t("recovery.progress.votes", {
                  approvals: progress.data.approvals ?? 0,
                  threshold: progress.data.threshold ?? 0,
                })}
              </p>
            </>
          ) : null}
          {status === "ready" ? (
            <>
              <p className="text-foreground text-sm">{t("recovery.progress.state.ready")}</p>
              <Button asChild>
                <Link to="/recovery/countdown" search={{ address }}>
                  {t("recovery.progress.countdownCta")}
                </Link>
              </Button>
            </>
          ) : null}
          {status === "executed" ? (
            <>
              <p className="text-foreground text-sm">{t("recovery.progress.state.executed")}</p>
              <Button asChild>
                <Link to="/recovery/done" search={{ address }}>
                  {t("recovery.progress.doneCta")}
                </Link>
              </Button>
            </>
          ) : null}
          {status === "vetoed" || status === "expired" ? (
            <p className="text-foreground text-sm">{t("recovery.progress.state.vetoed")}</p>
          ) : null}
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">{t("recovery.progress.checkNote")}</p>
    </main>
  );
}
