// Màn BỎ PHIẾU của guardian (PHA 6 cụm GHI). Cổng sinh trắc học = prompt
// passkey khi ký entry approve. Phiếu on-chain gắn với YÊU CẦU đang mở trên
// mạng (vật liệu khoá mới đã chốt lúc initiate) — màn hiện fingerprint từ
// mirror-chain để người bảo hộ đối chiếu với người thân qua kênh ngoài.
import { ApiError } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { guardianInboxKeys, guardianInboxOptions } from "@/features/family/api/guardian-inbox";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import {
  RecoverySignError,
  signRecoveryEntries,
} from "@/features/wallet/lib/sign-recovery-entries";
import { assertApproveRecoveryEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";

export const Route = createFileRoute("/_authenticated/guardian/approve")({
  validateSearch: z.object({ wallet: z.string().catch("") }),
  component: GuardianApproveScreen,
});

type ApproveErrorKey =
  | "guardian.approve.errors.alreadyVoted"
  | "guardian.approve.errors.closed"
  | "guardian.approve.errors.deviceKeyMissing"
  | "guardian.approve.errors.notSent";

function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const data = err.data as { error?: { code?: string } } | null;
  return data?.error?.code ?? null;
}

/** Taxonomy: phiếu ĐÃ đến mạng chưa — và vì sao không cần gửi lại. */
function approveErrorKey(err: unknown): ApproveErrorKey {
  if (err instanceof RecoverySignError) return "guardian.approve.errors.deviceKeyMissing";
  const code = apiErrorCode(err);
  if (code === "CONTRACT_ERROR:AlreadyApproved") return "guardian.approve.errors.alreadyVoted";
  if (
    code === "CONTRACT_ERROR:RecoveryCancelled" ||
    code === "CONTRACT_ERROR:NoActiveRecovery" ||
    code === "CONTRACT_ERROR:AlreadyFinalized"
  ) {
    return "guardian.approve.errors.closed";
  }
  return "guardian.approve.errors.notSent";
}

function GuardianApproveScreen() {
  const { t } = useTranslation("fw");
  const { wallet: walletId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inbox = useQuery(guardianInboxOptions);
  const item = (inbox.data ?? []).find((i) => i.wallet.id === walletId);

  const approve = useMutation({
    mutationFn: async (id: string) => {
      // Địa chỉ ví đang duyệt lấy từ hộp thư guardian (ví người bảo hộ đã CHỌN),
      // registry lấy từ env FE — không lấy từ phản hồi build của backend.
      const target = (inbox.data ?? []).find((i) => i.wallet.id === id);
      if (!env.VITE_RECOVERY_REGISTRY_ADDRESS) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
      if (!target) throw new BlindSignError("ENTRY_WRONG_SOURCE");
      const built = await buildRecoveryAction({ action: "approve", walletId: id });
      // CHỐNG KÝ MÙ: entry PHẢI là `approve_recovery` trên registry cho ĐÚNG ví —
      // một entry `transfer` từ ví người bảo hộ (backend bị chiếm) bị chối ở đây,
      // TRƯỚC khi chạm passkey.
      for (const entryXdr of built.auth_entries_xdr) {
        assertApproveRecoveryEntry(entryXdr, {
          registry: env.VITE_RECOVERY_REGISTRY_ADDRESS,
          wallet: target.wallet.stellarAddress,
        });
      }
      const signed = await signRecoveryEntries({
        entriesXdr: built.auth_entries_xdr,
        latestLedger: built.latest_ledger,
      });
      return submitRecoveryAction({ walletId: id, signedEntriesXdr: signed });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.all });
      await navigate({ to: "/guardian/approved", search: { tx: result.hash } });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardian.approve.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("guardian.approve.description")}</p>

      {inbox.isLoading ? <LoadingRows /> : null}
      {inbox.isError ? <ErrorState /> : null}
      {inbox.data && !item ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("guardian.approve.gone")} />
          <Button asChild variant="outline">
            <Link to="/guardian">{t("guardian.approve.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {item ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="text-foreground text-sm">
              {t("guardian.approve.votes", {
                approvals: item.request.approvals,
                threshold: item.request.threshold ?? item.wallet.threshold,
              })}
            </p>
            <p className="break-all font-mono text-muted-foreground text-xs">
              {t("guardian.approve.fingerprintLabel", { fingerprint: item.request.newOwner })}
            </p>
            <p className="text-muted-foreground text-xs">{t("guardian.approve.verifyNote")}</p>
            <p className="text-muted-foreground text-xs">{t("guardian.approve.biometricNote")}</p>

            {approve.isError ? (
              <p className="text-destructive text-sm" role="alert">
                {t(approveErrorKey(approve.error))}
              </p>
            ) : null}

            <Button disabled={approve.isPending} onClick={() => approve.mutate(item.wallet.id)}>
              {approve.isPending ? t("guardian.approve.signing") : t("guardian.approve.cta")}
            </Button>
            <Button asChild variant="ghost" disabled={approve.isPending}>
              <Link to="/guardian">{t("guardian.approve.backCta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
