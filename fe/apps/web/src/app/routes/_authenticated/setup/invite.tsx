// Bước MỜI người bảo hộ (wizard mức B — luồng tăng dần, thay stub).
//
// Màn này cố tình KHÔNG chặn: chủ ví rời đi lúc nào cũng được, ví vẫn chạy.
// Người bảo hộ nhận lời theo nhịp của HỌ, mỗi người một giao dịch độc lập.
// Điều quan trọng nhất trên màn là câu trả lời thật cho "ví đã cứu được chưa" —
// đặt ngay đầu, không giấu dưới danh sách.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/family/ui";
import {
  createInvite,
  type GuardianInvite,
  inviteKeys,
  invitesOptions,
  markInviteRegistered,
} from "@/features/family/api/invites";
import { chainTruthOptions } from "@/features/family/api/recovery";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { InviteCard } from "@/features/family/components/invite-card";
import {
  type AddGuardianErrorKey,
  InviteStatusList,
} from "@/features/family/components/invite-status-list";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";
import { ApiError } from "@/lib/api-client";
import { assertAddGuardianEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";

/**
 * Mỗi mã lỗi MỘT câu (bug 28/07: "Chưa có gì thay đổi" che cả 5 nguyên nhân) —
 * người dùng phải biết việc tiếp theo là gì, không phải "thử lại" vô vọng.
 */
function addGuardianErrorKey(err: unknown): AddGuardianErrorKey {
  const code =
    err instanceof ApiError
      ? (err.data as { error?: { code?: string } } | undefined)?.error?.code
      : undefined;
  if (code === "GUARDIAN_ALREADY_ADDED") return "guardians.inviteList.addFailedAlready";
  if (code === "GUARDIAN_IS_OWNER") return "guardians.inviteList.addFailedSelf";
  return "guardians.inviteList.addFailed";
}

export const Route = createFileRoute("/_authenticated/setup/invite")({
  component: SetupInviteScreen,
});

function SetupInviteScreen() {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const [label, setLabel] = useState("");
  // Giữ CẢ DANH SÁCH lời mời tạo trong phiên (trước đây chỉ giữ link CUỐI —
  // tạo người thứ hai là mất đường gửi cho người thứ nhất). Token chỉ có ở
  // response lúc tạo; API danh sách không trả lại (chống rò) — nợ BE nếu cần
  // hiện lại QR sau reload.
  const [created, setCreated] = useState<Array<{ label: string; token: string }>>([]);

  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const create = useMutation({
    mutationFn: () => createInvite({ walletId: wallet?.id ?? "", label: label.trim() }),
    onSuccess: async (res) => {
      setCreated((cards) => [{ label: res.label, token: res.token }, ...cards]);
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: inviteKeys.byWallet(wallet?.id ?? "") });
    },
  });

  // Ghép ở tầng app/: build (family) → ký bằng passkey chủ ví (wallet) → submit.
  // MỘT giao dịch cho MỘT người — không gom, không chờ ai.
  const addGuardian = useMutation({
    mutationFn: async (invite: GuardianInvite) => {
      const walletId = wallet?.id ?? "";
      const guardianAddress = invite.guardian_address ?? "";
      // Ví CHƯA đăng ký registry → contract chối `add_guardian` bằng
      // `#2 NotRegistered` (bug 28/07). Giai đoạn này "Thêm vào ví" chỉ CHỐT
      // trong DB; bước "Đăng ký lên blockchain" (màn Xác nhận) sẽ gom CẢ danh
      // sách vào một lệnh `register_wallet`. Sau khi ví đã đăng ký, người thêm
      // sau mới đi đường `add_guardian` on-chain như dưới.
      const truth = await queryClient.fetchQuery(chainTruthOptions(walletId));
      if (!truth.registered) {
        await markInviteRegistered(invite.id);
        return;
      }
      const built = await buildRecoveryAction({
        action: "addGuardian",
        walletId,
        guardianAddress,
      });
      // CHỐNG KÝ MÙ: entry phải thêm ĐÚNG địa chỉ vừa gửi đi. Không chốt thì
      // backend tráo một địa chỉ khác là chủ ví tự tay ký cho người lạ vào làm
      // người bảo hộ — trong khi màn hình vẫn chỉ hiện tên gọi thân mật.
      if (!env.VITE_RECOVERY_REGISTRY_ADDRESS) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
      if (!wallet) throw new BlindSignError("ENTRY_WRONG_SOURCE");
      for (const entryXdr of built.auth_entries_xdr) {
        assertAddGuardianEntry(entryXdr, {
          registry: env.VITE_RECOVERY_REGISTRY_ADDRESS,
          wallet: wallet.stellarAddress,
          guardian: guardianAddress,
        });
      }
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
    <ProductScreen>
      <ScreenHeader title={t("setup.invite.title")} description={t("setup.invite.description")} />

      {loading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      {invites.data ? <RecoverabilityBanner value={invites.data.recoverability} /> : null}

      <Card className="bg-paper-2">
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
            loading={create.isPending}
            disabled={label.trim().length === 0 || wallet === null}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("setup.invite.creating") : t("setup.invite.createCta")}
          </Button>
          {/* Nút tắt phải nói lý do — cùng khuôn choose-guardians. */}
          {label.trim().length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("setup.invite.labelRequired")}</p>
          ) : null}
          {create.isError ? (
            <ErrorBanner type="error" title={t("setup.invite.createFailed")} />
          ) : null}
        </CardContent>
      </Card>

      {created.map((card) => (
        <InviteCard key={card.token} label={card.label} token={card.token} />
      ))}

      {invites.data ? (
        <InviteStatusList
          invites={invites.data.invites}
          onAdd={(invite) => addGuardian.mutate(invite)}
          pending={addGuardian.isPending}
          errorKey={addGuardian.isError ? addGuardianErrorKey(addGuardian.error) : null}
        />
      ) : null}

      <PrimaryZone>
        <Button asChild variant="ghost">
          <Link to="/wallet">{t("setup.invite.doneCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
