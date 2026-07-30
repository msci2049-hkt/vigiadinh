// Bước 3: tiến độ khôi phục (PUBLIC, poll 30s — dữ liệu vốn public on-chain).
// Mỗi trạng thái một câu chữ người thường + đường đi kế: chờ phiếu → cửa sổ
// chờ (countdown) → xong (done) → hoặc đã bị chặn.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { publicProgressOptions } from "@/features/wallet/api/device-recovery";
import { explorerTxUrl } from "@/lib/stellar-explorer";

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
    <ProductScreen>
      <ScreenHeader
        title={t("recovery.progress.title")}
        description={t("recovery.progress.description")}
      />
      {address === "" ? (
        <ErrorBanner type="warn" title={t("recovery.progress.missingTitle")}>
          {t("recovery.progress.checkNote")}
        </ErrorBanner>
      ) : null}
      {progress.isLoading ? <LoadingRows /> : null}
      {progress.isError ? <ErrorState /> : null}

      {progress.data ? (
        <Card>
          <CardContent className="space-y-5">
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
                <div className="flex items-center gap-2" aria-hidden>
                  {Array.from(
                    { length: progress.data.threshold ?? 0 },
                    (_, index) => index + 1,
                  ).map((slot) => (
                    <span
                      key={`approval-slot-${slot}`}
                      className={
                        slot <= (progress.data.approvals ?? 0)
                          ? "flex size-9 items-center justify-center rounded-full bg-success/10 text-success"
                          : "flex size-9 items-center justify-center rounded-full border border-dashed text-muted-foreground"
                      }
                    >
                      <Icon
                        name={slot <= (progress.data.approvals ?? 0) ? "checkCircle" : "clock"}
                        size={20}
                      />
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            {status === "ready" ? (
              <p className="text-foreground text-sm">{t("recovery.progress.state.ready")}</p>
            ) : null}
            {(status === "pending" || status === "ready") &&
            (progress.data.approvers?.length ?? 0) > 0 ? (
              // Bằng chứng ĐÚNG NGƯỜI (R4-B3/B4): địa chỉ người xác nhận đủ 56 ký
              // tự — lấy từ THAM SỐ lời gọi on-chain. Source account của tx là ví
              // phí dùng chung, tuyệt đối không được trưng ra như "người duyệt".
              <section className="space-y-3">
                <h2 className="font-semibold text-foreground text-sm">
                  {t("recovery.progress.approversTitle")}
                </h2>
                <p className="text-muted-foreground text-sm">{t("recovery.progress.feeNote")}</p>
                <ul className="space-y-2">
                  {(progress.data.approvers ?? []).map((approver) => (
                    <li
                      key={approver.guardian}
                      className="rounded-card border border-dashed bg-card p-3"
                    >
                      <p className="break-all font-mono text-muted-foreground text-xs">
                        {approver.guardian}
                      </p>
                      {approver.txHash ? (
                        <a
                          href={explorerTxUrl(approver.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-sm underline"
                        >
                          {t("recovery.progress.approverLink")}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {status === "executed" ? (
              <p className="text-foreground text-sm">{t("recovery.progress.state.executed")}</p>
            ) : null}
            {status === "vetoed" || status === "expired" ? (
              <p className="text-foreground text-sm">{t("recovery.progress.state.vetoed")}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <PrimaryZone>
        {address === "" ? (
          <Button asChild>
            <Link to="/recovery/find-wallet">{t("recovery.progress.missingAddressCta")}</Link>
          </Button>
        ) : status === "ready" ? (
          <Button asChild>
            <Link to="/recovery/countdown" search={{ address }}>
              {t("recovery.progress.countdownCta")}
            </Link>
          </Button>
        ) : status === "executed" ? (
          <Button asChild>
            <Link to="/recovery/done" search={{ address }}>
              {t("recovery.progress.doneCta")}
            </Link>
          </Button>
        ) : (
          <Button disabled>{t("recovery.progress.waitingCta")}</Button>
        )}
        <p className="text-center text-muted-foreground text-sm">
          {t("recovery.progress.checkNote")}
        </p>
      </PrimaryZone>
    </ProductScreen>
  );
}
