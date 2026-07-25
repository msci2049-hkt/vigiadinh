// Cửa sổ chờ (timelock) nhìn từ phía NGƯỜI KHÔI PHỤC: đủ phiếu rồi nhưng chủ
// ví cũ vẫn còn quyền chặn tới hết cửa sổ — hiện CẢ đếm ngược LẪN mốc tuyệt
// đối (luật i18n §2, timelockView PHA 7.1). Poll để tự chuyển khi xong.
import { timelockView } from "@repo/core";
import { Button } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { TimelockCountdown } from "@/components/family/timelock-countdown";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { publicProgressOptions } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/countdown")({
  validateSearch: z.object({
    address: z
      .string()
      .regex(/^C[A-Z2-7]{55}$/)
      .catch(""),
  }),
  component: RecoveryCountdownScreen,
});

function RecoveryCountdownScreen() {
  const { t, i18n } = useTranslation("fw");
  const { address } = Route.useSearch();
  const progress = useQuery({ ...publicProgressOptions(address), enabled: address !== "" });
  const veto = progress.data?.vetoUntil
    ? timelockView(progress.data.vetoUntil, { locale: i18n.language })
    : null;

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("recovery.countdown.title")}
        description={t("recovery.countdown.description")}
      />
      {progress.isLoading ? <LoadingRows /> : null}
      {progress.isError ? <ErrorState /> : null}

      {veto && !veto.expired ? (
        <TimelockCountdown
          countdown={veto.countdown}
          absolute={veto.absolute}
          label={t("recovery.countdown.windowLabel")}
          large
        />
      ) : null}
      <ErrorBanner type="info" title={t("recovery.countdown.protectionTitle")}>
        {t("recovery.countdown.note")}
      </ErrorBanner>
      <PrimaryZone>
        {progress.data?.status === "executed" ? (
          <Button asChild className="w-full">
            <Link to="/recovery/done" search={{ address }}>
              {t("recovery.countdown.doneCta")}
            </Link>
          </Button>
        ) : (
          <Button disabled>{t("recovery.countdown.doneCta")}</Button>
        )}
        <Button asChild variant="link" className="w-full">
          <Link to="/recovery/progress" search={{ address }}>
            {t("recovery.countdown.backCta")}
          </Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
