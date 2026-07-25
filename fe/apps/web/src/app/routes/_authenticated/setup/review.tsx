// Bước XEM LẠI — chốt cấu hình rồi đăng ký lên chain (thay stub).
//
// `register_wallet` cần ĐỦ ngưỡng người bảo hộ đã lên chain (contract chặn
// threshold > số guardian). Nên nút đăng ký chỉ mở khi đủ; chưa đủ thì màn nói
// rõ còn thiếu ai và ví vẫn chạy bình thường trong lúc chờ — không chặn đường.
//
// Sau khi đăng ký, ngưỡng + thời gian chờ ĐÓNG BĂNG trên chain.
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { inviteKeys, invitesOptions } from "@/features/family/api/invites";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { timelockLabelKey } from "@/features/family/api/wallets";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";
import { assertRegisterWalletEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";

export const Route = createFileRoute("/_authenticated/setup/review")({
  component: SetupReviewScreen,
});

function SetupReviewScreen() {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const recoverability = invites.data?.recoverability;
  const canRegister = recoverability?.recoverable === true;
  // Địa chỉ người bảo hộ chủ ví ĐÃ THẤY (từ chính danh sách lời mời của mình) —
  // mốc đối chiếu cho entry `register_wallet` trước khi ký.
  const guardianAddresses = (invites.data?.invites ?? [])
    .map((i) => i.guardian_address)
    .filter((a): a is string => typeof a === "string" && a.length > 0);

  // Đăng ký lên registry: build → ký bằng passkey chủ ví → submit.
  const register = useMutation({
    mutationFn: async () => {
      const walletId = wallet?.id ?? "";
      const built = await buildRecoveryAction({ action: "register", walletId });
      // CHỐNG KÝ MÙ — nặng nhất trong cả app: `register_wallet` chỉ chạy MỘT
      // lần (lần hai contract chối `AlreadyRegistered`), nên ký nhầm ngưỡng hay
      // nhầm danh sách người bảo hộ là hỏng VĨNH VIỄN, không có đường sửa.
      // Registry lấy từ env của FE, không lấy từ phản hồi backend.
      if (!env.VITE_RECOVERY_REGISTRY_ADDRESS) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
      if (!wallet) throw new BlindSignError("ENTRY_WRONG_SOURCE");
      for (const entryXdr of built.auth_entries_xdr) {
        assertRegisterWalletEntry(entryXdr, {
          registry: env.VITE_RECOVERY_REGISTRY_ADDRESS,
          wallet: wallet.stellarAddress,
          allowedGuardians: guardianAddresses,
          threshold: wallet.threshold,
          timelockSecs: wallet.timelockSecs,
        });
      }
      const signed = await signRecoveryEntries({
        entriesXdr: built.auth_entries_xdr,
        latestLedger: built.latest_ledger,
      });
      return submitRecoveryAction({ walletId, signedEntriesXdr: signed });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.byWallet(wallet?.id ?? "") });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("setup.review.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("setup.review.description")}</p>

      {walletLoading || invites.isLoading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      {wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setup.review.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("setup.review.thresholdLabel")}</span>
              <span data-testid="review-threshold">
                {t("setup.review.thresholdValue", { count: wallet.threshold })}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("setup.review.timelockLabel")}</span>
              <span data-testid="review-timelock">{t(timelockLabelKey(wallet.timelockSecs))}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("setup.review.guardiansLabel")}</span>
              <span data-testid="review-guardians">{recoverability?.available ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {recoverability ? <RecoverabilityBanner value={recoverability} /> : null}

      {register.isSuccess ? (
        <p
          className="rounded-md border border-border bg-muted/40 p-3 text-sm"
          role="status"
          data-testid="review-registered"
        >
          {t("setup.review.registered")}
        </p>
      ) : null}
      {register.isError ? (
        <p className="text-destructive text-sm" role="alert" data-testid="review-register-failed">
          {t("setup.review.registerFailed")}
        </p>
      ) : null}

      {canRegister && !register.isSuccess ? (
        <Button
          disabled={register.isPending}
          onClick={() => register.mutate()}
          data-testid="review-register"
        >
          {register.isPending ? t("setup.review.registering") : t("setup.review.registerCta")}
        </Button>
      ) : null}

      {!canRegister ? (
        <Button asChild variant="outline">
          <Link to="/setup/invite">{t("setup.review.inviteMoreCta")}</Link>
        </Button>
      ) : null}

      <Button asChild variant="ghost">
        <Link to="/wallet">{t("setup.review.doneCta")}</Link>
      </Button>
    </main>
  );
}
