// Bước MỜI người bảo hộ (wizard mức B — luồng tăng dần, thay stub).
//
// Màn này cố tình KHÔNG chặn: chủ ví rời đi lúc nào cũng được, ví vẫn chạy.
// Người bảo hộ nhận lời theo nhịp của HỌ, mỗi người một giao dịch độc lập.
// Điều quan trọng nhất trên màn là câu trả lời thật cho "ví đã cứu được chưa" —
// đặt ngay đầu, không giấu dưới danh sách.
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createInvite,
  type GuardianInvite,
  inviteKeys,
  invitesOptions,
  markInviteRegistered,
} from "@/features/family/api/invites";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { InviteStatusList } from "@/features/family/components/invite-status-list";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";

export const Route = createFileRoute("/_authenticated/setup/invite")({
  component: SetupInviteScreen,
});

function SetupInviteScreen() {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const [label, setLabel] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const create = useMutation({
    mutationFn: () => createInvite({ walletId: wallet?.id ?? "", label: label.trim() }),
    onSuccess: async (res) => {
      setLastLink(`${window.location.origin}/guardian/accept?token=${res.token}`);
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: inviteKeys.byWallet(wallet?.id ?? "") });
    },
  });

  // Ghép ở tầng app/: build (family) → ký bằng passkey chủ ví (wallet) → submit.
  // MỘT giao dịch cho MỘT người — không gom, không chờ ai.
  const addGuardian = useMutation({
    mutationFn: async (invite: GuardianInvite) => {
      const walletId = wallet?.id ?? "";
      const built = await buildRecoveryAction({
        action: "addGuardian",
        walletId,
        guardianAddress: invite.guardian_address ?? "",
      });
      const signed = await signRecoveryEntries({
        entriesXdr: built.auth_entries_xdr,
        latestLedger: built.latest_ledger,
      });
      await submitRecoveryAction({ walletId, signedEntriesXdr: signed });
      await markInviteRegistered(invite.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.byWallet(wallet?.id ?? "") });
    },
  });

  const loading = walletLoading || invites.isLoading;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("setup.invite.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("setup.invite.description")}</p>

      {loading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      {invites.data ? <RecoverabilityBanner value={invites.data.recoverability} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("setup.invite.addTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            aria-label={t("setup.invite.labelField")}
            placeholder={t("setup.invite.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            disabled={label.trim().length === 0 || create.isPending || wallet === null}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("setup.invite.creating") : t("setup.invite.createCta")}
          </Button>
          {create.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {t("setup.invite.createFailed")}
            </p>
          ) : null}
          {lastLink ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("setup.invite.linkHint")}</p>
              <code className="break-all text-xs">{lastLink}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(lastLink)}
              >
                {t("setup.invite.copyCta")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {invites.data ? (
        <InviteStatusList
          invites={invites.data.invites}
          onAdd={(invite) => addGuardian.mutate(invite)}
          pending={addGuardian.isPending}
          failed={addGuardian.isError}
        />
      ) : null}

      <Button asChild variant="ghost">
        <Link to="/wallet">{t("setup.invite.doneCta")}</Link>
      </Button>
    </main>
  );
}
