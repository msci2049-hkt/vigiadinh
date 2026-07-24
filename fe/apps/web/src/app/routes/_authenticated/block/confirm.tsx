// Màn XÁC NHẬN chặn (PHA 6 cụm GHI) — hành động ghi on-chain đầu tiên của FE.
// Cổng sinh trắc học = CHÍNH prompt passkey khi ký entry (kit) — không có "nút
// xác nhận" nào thay được chữ ký. Taxonomy lỗi trả lời đúng một câu hỏi:
// "lệnh chặn ĐÃ đến mạng chưa?" — chưa ký / chưa gửi ≠ đã gửi mà thất bại.
import { ApiError } from "@repo/core";
import { Button } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { recoveryKeys } from "@/features/family/api/recovery";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import {
  RecoverySignError,
  signRecoveryEntries,
} from "@/features/wallet/lib/sign-recovery-entries";

export const Route = createFileRoute("/_authenticated/block/confirm")({
  component: BlockConfirmScreen,
});

/** Mã lỗi trong envelope BE `{error:{code}}` — null nếu không phải ApiError. */
function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const data = err.data as { error?: { code?: string } } | null;
  return data?.error?.code ?? null;
}

type VetoErrorKey =
  | "block.confirm.errors.walletLocked"
  | "block.confirm.errors.alreadyStopped"
  | "block.confirm.errors.tooLate"
  | "block.confirm.errors.notSent";

/** Taxonomy lỗi veto → key i18n. Trả lời "lệnh đã đến mạng chưa". */
function vetoErrorKey(err: unknown): VetoErrorKey {
  if (err instanceof RecoverySignError) {
    // Chưa ký được (ví chưa mở / build không có entry của ví) — CHƯA gì được gửi.
    return err.message === "WALLET_NOT_CONNECTED"
      ? "block.confirm.errors.walletLocked"
      : "block.confirm.errors.notSent";
  }
  const code = apiErrorCode(err);
  if (code === "CONTRACT_ERROR:RecoveryCancelled" || code === "CONTRACT_ERROR:NoActiveRecovery") {
    // Người khác (hoặc chính mình ở máy khác) đã chặn trước — coi như đã an toàn.
    return "block.confirm.errors.alreadyStopped";
  }
  if (code === "CONTRACT_ERROR:AlreadyFinalized") {
    // Muộn: khôi phục đã hoàn tất trước khi chặn — nói thẳng, không vòng vo.
    return "block.confirm.errors.tooLate";
  }
  // Người dùng huỷ prompt passkey (NotAllowedError của WebAuthn) hoặc lỗi mạng
  // TRƯỚC submit — chưa có gì đến mạng.
  return "block.confirm.errors.notSent";
}

function BlockConfirmScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wallet, isLoading, isError } = useActiveWallet();

  const veto = useMutation({
    mutationFn: async (walletId: string) => {
      const built = await buildRecoveryAction({ action: "veto", walletId });
      const signed = await signRecoveryEntries({
        entriesXdr: built.auth_entries_xdr,
        latestLedger: built.latest_ledger,
      });
      return submitRecoveryAction({ walletId, signedEntriesXdr: signed });
    },
    onSuccess: async (result) => {
      // Mirror sẽ được indexer cập nhật từ event `cancel` — invalidate để màn
      // night-watch/history kéo lại khi indexer bắt kịp.
      await queryClient.invalidateQueries({ queryKey: recoveryKeys.all });
      await navigate({ to: "/block/done", search: { tx: result.hash } });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("block.confirm.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("block.confirm.description")}</p>
      <p className="text-muted-foreground text-xs">{t("block.confirm.biometricNote")}</p>

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      {veto.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {t(vetoErrorKey(veto.error))}
        </p>
      ) : null}

      <div className="mt-2 flex w-full flex-col gap-2">
        <Button
          variant="destructive"
          disabled={wallet === null || veto.isPending}
          onClick={() => wallet && veto.mutate(wallet.id)}
        >
          {veto.isPending ? t("block.confirm.signing") : t("block.confirm.cta")}
        </Button>
        <Button asChild variant="ghost" disabled={veto.isPending}>
          <Link to="/night-watch">{t("block.confirm.backCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
