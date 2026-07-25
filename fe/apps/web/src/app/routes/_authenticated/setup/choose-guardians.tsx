// Bước CHỌN NGƯỜI BẢO HỘ (wizard mức B — thay stub).
//
// Cùng dữ liệu với /setup/invite nhưng là một bước trong luồng wizard: có lối
// đi tiếp sang chọn ngưỡng. Cố ý KHÔNG chặn nút "tiếp" khi còn người pending —
// đó là toàn bộ điểm của luồng tăng dần: ví đã chạy từ bước 1-2, bắt chờ đủ
// người mới cho đi tiếp là quay lại đúng bẫy "một người chậm treo cả nhà".

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/family/ui";
import { createInvite, inviteKeys, invitesOptions } from "@/features/family/api/invites";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { WizardNav } from "@/features/family/components/wizard-nav";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/setup/choose-guardians")({
  component: SetupChooseGuardiansScreen,
});

function SetupChooseGuardiansScreen() {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const [label, setLabel] = useState("");

  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const create = useMutation({
    mutationFn: () => createInvite({ walletId: wallet?.id ?? "", label: label.trim() }),
    onSuccess: async () => {
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: inviteKeys.byWallet(wallet?.id ?? "") });
    },
  });

  return (
    <ProductScreen>
      <WizardNav step={1} />
      <ScreenHeader
        title={t("setup.chooseGuardians.title")}
        description={t("setup.chooseGuardians.description")}
      />

      {walletLoading || invites.isLoading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      {invites.data ? <RecoverabilityBanner value={invites.data.recoverability} /> : null}

      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("setup.chooseGuardians.addTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            aria-label={t("setup.invite.labelField")}
            placeholder={t("setup.invite.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            variant="secondary"
            loading={create.isPending}
            disabled={label.trim().length === 0 || wallet === null}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("setup.invite.creating") : t("setup.invite.createCta")}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/setup/invite">{t("setup.chooseGuardians.manageCta")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Đi tiếp được kể cả khi chưa ai nhận lời — luồng tăng dần. */}
      <PrimaryZone>
        <Button asChild data-testid="wizard-next-threshold">
          <Link to="/setup/threshold">{t("setup.chooseGuardians.nextCta")}</Link>
        </Button>
        <p className="text-center text-muted-foreground text-xs">
          {t("setup.chooseGuardians.canLeaveHint")}
        </p>
      </PrimaryZone>
    </ProductScreen>
  );
}
