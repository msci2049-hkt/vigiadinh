// Cửa sổ chờ (timelock) nhìn từ phía NGƯỜI KHÔI PHỤC: đủ phiếu rồi nhưng chủ
// ví cũ vẫn còn quyền chặn tới hết cửa sổ — hiện CẢ đếm ngược LẪN mốc tuyệt
// đối (luật i18n §2, timelockView PHA 7.1). Poll để tự chuyển khi xong.
//
// Lô R6 — màn này giờ là ĐÍCH của cả luồng: hết giờ thì nút "Lấy lại ví" bật và
// gọi thẳng `POST /api/recovery/finalize`. Trước lô này route đó có đủ ở BE mà
// KHÔNG một chỗ nào trong app gọi (`recovery-actions.ts` export finalizeRecovery,
// zero import; không cron nào) — nghĩa là sau khi đủ phiếu và hết 24 giờ, không
// có đường nào hoàn tất khôi phục từ trong sản phẩm.
//
// KHÔNG chạm vân tay ở đây, có chủ đích: `finalize_recovery` không đòi chữ ký
// người dùng nào (lib.rs:378) — timelock + threshold là người gác on-chain. Hỏi
// vân tay chỉ để "cho chắc" là dựng một cửa giả mà người vừa mất máy có thể
// không qua nổi. Cửa THẬT là `memberRole` ở BE: phải đăng nhập bằng chính tài
// khoản chủ ví (địa chỉ ví không đổi sau khôi phục).

import { sessionQueryOptions } from "@repo/auth";
import { timelockView } from "@repo/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { LiveCountdown } from "@/components/family/live-countdown";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { SuccessNote } from "@/components/family/success-note";
import { Button } from "@/components/family/ui";
import { finalizeRecovery } from "@/features/family/api/recovery-actions";
import { walletsOptions } from "@/features/family/api/wallets";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { publicProgressOptions } from "@/features/wallet/api/device-recovery";
import { authClient } from "@/lib/auth-client";
import { finalizeOutcome } from "@/lib/recovery-sign-outcome";

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
  const navigate = useNavigate();
  const progress = useQuery({ ...publicProgressOptions(address), enabled: address !== "" });
  const veto = progress.data?.vetoUntil
    ? timelockView(progress.data.vetoUntil, { locale: i18n.language })
    : null;

  // Màn này PUBLIC (người mất máy tới đây trước cả khi đăng nhập lại). Phiên chỉ
  // cần cho bước cuối, nên hỏi nhẹ nhàng và không đá ai ra ngoài.
  const session = useQuery(sessionQueryOptions(authClient));
  const signedIn = Boolean(session.data?.user);
  const wallets = useQuery({ ...walletsOptions, enabled: signedIn });
  const wallet = (wallets.data ?? []).find((w) => w.stellarAddress === address) ?? null;

  const windowClosed = progress.data?.status === "ready" && veto !== null && veto.expired;

  const finalize = useMutation({
    mutationFn: async (walletId: string) => finalizeRecovery({ walletId }),
    onSuccess: async () => {
      await navigate({ to: "/recovery/done", search: { address } });
    },
  });
  const outcome = finalize.isError ? finalizeOutcome(finalize.error) : null;

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("recovery.countdown.title")}
        description={t("recovery.countdown.description")}
      />
      {progress.isLoading ? <LoadingRows /> : null}
      {progress.isError ? <ErrorState /> : null}

      {/* R7 (D3) — đồng hồ chạy từng giây, cùng component với ba màn chờ kia.
          `veto.expired` vẫn quyết định nút "Lấy lại ví" (windowClosed dưới);
          đồng hồ thì hiện cả khi đã hết, dừng ở 00:00:00 + đổi câu (D5), vì
          người chờ suốt 24 giờ cần thấy nó đã tới đích chứ không phải thấy nó
          biến mất. */}
      {progress.data?.vetoUntil ? (
        <LiveCountdown
          deadline={progress.data.vetoUntil}
          label={t("recovery.countdown.windowLabel")}
          large
        />
      ) : null}
      <ErrorBanner type="info" title={t("recovery.countdown.protectionTitle")}>
        {t("recovery.countdown.note")}
      </ErrorBanner>

      {/* Lệnh đã đóng trong lúc chờ — nói thẳng, đừng để nút "Lấy lại ví" mời
          bấm vào một yêu cầu không còn tồn tại. */}
      {progress.data?.status === "vetoed" || progress.data?.status === "expired" ? (
        <ErrorBanner type="warn" title={t("recovery.countdown.stoppedTitle")}>
          {t("recovery.countdown.stoppedBody")}
        </ErrorBanner>
      ) : null}

      {outcome?.kind === "tooEarly" ? (
        <ErrorBanner type="pending" title={t("recovery.finalize.errors.tooEarly")} />
      ) : null}
      {outcome?.kind === "stopped" ? (
        <ErrorBanner type="warn" title={t("recovery.countdown.stoppedTitle")}>
          {t("recovery.countdown.stoppedBody")}
        </ErrorBanner>
      ) : null}
      {outcome?.kind === "done" ? (
        // Máy khác (hoặc chính mình) đã hoàn tất trước — TIN TỐT, không phải lỗi.
        <SuccessNote title={t("recovery.finalize.alreadyDone")} />
      ) : null}
      {outcome?.kind === "error" ? <ErrorBanner type="error" title={t(outcome.key)} /> : null}

      <PrimaryZone>
        {progress.data?.status === "executed" ? (
          <Button asChild className="w-full">
            <Link to="/recovery/done" search={{ address }}>
              {t("recovery.countdown.doneCta")}
            </Link>
          </Button>
        ) : !signedIn ? (
          // Chưa đăng nhập: bước cuối cần BE biết bạn là chủ ví. Nói TRƯỚC, ngay
          // lúc còn đang chờ, để họ đăng nhập sẵn thay vì tới giờ mới loay hoay.
          <>
            <Button asChild className="w-full">
              <Link to="/login" search={{ redirect: `/recovery/countdown?address=${address}` }}>
                {t("recovery.finalize.signInCta")}
              </Link>
            </Button>
            <p className="text-center text-muted-foreground text-sm">
              {t("recovery.finalize.signInNote")}
            </p>
          </>
        ) : wallets.isSuccess && !wallet ? (
          <ErrorBanner type="warn" title={t("recovery.finalize.errors.notYourWallet")} />
        ) : (
          <>
            <Button
              className="w-full"
              variant="danger"
              data-testid="recovery-finalize"
              loading={finalize.isPending}
              disabled={!windowClosed || wallet === null || finalize.isPending}
              onClick={() => wallet && finalize.mutate(wallet.id)}
            >
              {finalize.isPending ? t("recovery.finalize.working") : t("recovery.finalize.cta")}
            </Button>
            {!windowClosed ? (
              <p className="text-center text-muted-foreground text-sm">
                {t("recovery.finalize.waitNote")}
              </p>
            ) : null}
          </>
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
