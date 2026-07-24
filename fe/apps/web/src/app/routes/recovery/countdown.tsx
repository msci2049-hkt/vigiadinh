// Cửa sổ chờ (timelock) nhìn từ phía NGƯỜI KHÔI PHỤC: đủ phiếu rồi nhưng chủ
// ví cũ vẫn còn quyền chặn tới hết cửa sổ — hiện CẢ đếm ngược LẪN mốc tuyệt
// đối (luật i18n §2, timelockView PHA 7.1). Poll để tự chuyển khi xong.
import { timelockView } from "@repo/core";
import { Button } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.countdown.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.countdown.description")}</p>

      {progress.isLoading ? <LoadingRows /> : null}
      {progress.isError ? <ErrorState /> : null}

      {veto && !veto.expired ? (
        <p className="rounded-md bg-muted p-3 text-foreground text-sm">
          {t("recovery.countdown.window", { countdown: veto.countdown, absolute: veto.absolute })}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">{t("recovery.countdown.note")}</p>

      {progress.data?.status === "executed" ? (
        <Button asChild className="w-full">
          <Link to="/recovery/done" search={{ address }}>
            {t("recovery.countdown.doneCta")}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link to="/recovery/progress" search={{ address }}>
            {t("recovery.countdown.backCta")}
          </Link>
        </Button>
      )}
    </main>
  );
}
