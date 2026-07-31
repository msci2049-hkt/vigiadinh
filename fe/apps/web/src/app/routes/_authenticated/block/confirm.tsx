// Màn XÁC NHẬN chặn (PHA 6 cụm GHI) — hành động ghi on-chain đầu tiên của FE.
// Cổng sinh trắc học = CHÍNH prompt passkey khi ký entry (kit) — không có "nút
// xác nhận" nào thay được chữ ký. Taxonomy lỗi trả lời đúng một câu hỏi:
// "lệnh chặn ĐÃ đến mạng chưa?" — chưa ký / chưa gửi ≠ đã gửi mà thất bại.
// R5: phân loại qua @/lib/recovery-sign-outcome — phiên ví hết thì chạm vân tay
// xin lại phiên (một lần); "đã có người chặn trước" là TIN TỐT, không phải lỗi.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ReconfirmSign } from "@/components/family/reconfirm-sign";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { SuccessNote } from "@/components/family/success-note";
import { Button } from "@/components/family/ui";
import { recoveryKeys } from "@/features/family/api/recovery";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { useWalletReconfirm } from "@/features/wallet/hooks/use-wallet-reconfirm";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";
import { assertCancelRecoveryEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";
import { vetoOutcome } from "@/lib/recovery-sign-outcome";

export const Route = createFileRoute("/_authenticated/block/confirm")({
  component: BlockConfirmScreen,
});

function BlockConfirmScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wallet, isLoading, isError } = useActiveWallet();
  const reconfirm = useWalletReconfirm();

  const veto = useMutation({
    mutationFn: async (walletId: string) => {
      // Registry từ env FE, địa chỉ ví là ví hiện hoạt của chính chủ ví — không
      // lấy gì từ phản hồi build của backend.
      if (!env.VITE_RECOVERY_REGISTRY_ADDRESS) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
      if (!wallet) throw new BlindSignError("ENTRY_WRONG_SOURCE");
      const built = await buildRecoveryAction({ action: "veto", walletId });
      // CHỐNG KÝ MÙ: entry PHẢI là `cancel_recovery` trên registry cho ĐÚNG ví —
      // không cho một entry `transfer` lọt qua màn "xác nhận đóng ví".
      for (const entryXdr of built.auth_entries_xdr) {
        assertCancelRecoveryEntry(entryXdr, {
          registry: env.VITE_RECOVERY_REGISTRY_ADDRESS,
          wallet: wallet.stellarAddress,
        });
      }
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

  const outcome = veto.isError ? vetoOutcome(veto.error) : null;

  return (
    <ProductScreen className="items-center justify-center text-center">
      <span className="grid size-20 place-items-center rounded-full bg-destructive text-destructive-foreground">
        <Icon name="ban" size={32} />
      </span>
      <ScreenHeader
        title={t("block.confirm.title")}
        description={t("block.confirm.description")}
        className="text-center"
      />
      <div className="flex items-center gap-3 rounded-card border border-dashed bg-card p-4 text-left">
        <Icon name="fingerprint" size={32} />
        <p className="text-muted-foreground text-sm">{t("block.confirm.biometricNote")}</p>
      </div>

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      {outcome?.kind === "stopped" ? (
        // Người khác (hoặc chính mình ở máy khác) đã chặn trước — TIN TỐT.
        <SuccessNote title={t("block.confirm.errors.alreadyStopped")} />
      ) : null}
      {outcome?.kind === "reconfirm" ? (
        // Phiên ví hết — máy VẪN CÓ passkey: chạm vân tay xin lại phiên,
        // KHÔNG bắt đăng xuất (§4, đúng MỘT lần thử lại).
        <ReconfirmSign
          phase={reconfirm.phase}
          onStart={() => reconfirm.start(() => wallet && veto.mutate(wallet.id))}
        />
      ) : null}
      {outcome?.kind === "error" ? <ErrorBanner type="error" title={t(outcome.key)} /> : null}

      <PrimaryZone className="w-full">
        <Button
          variant="danger"
          loading={veto.isPending}
          disabled={wallet === null}
          onClick={() => wallet && veto.mutate(wallet.id)}
        >
          <Icon name="fingerprint" />
          {veto.isPending ? t("block.confirm.signing") : t("block.confirm.cta")}
        </Button>
        <Button asChild variant="ghost" disabled={veto.isPending}>
          <Link to="/night-watch">{t("block.confirm.backCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
