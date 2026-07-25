// Bước CHỌN NGƯỠNG — cần bao nhiêu người đồng ý để mở lại ví (thay stub).
//
// Mặc định 2. Cảnh báo hiện ngay khi số người ĐÃ LÊN CHAIN nhỏ hơn ngưỡng đang
// chọn — người dùng thấy hậu quả TRƯỚC khi bấm lưu, thay vì phát hiện lúc mất
// máy (lúc đó không sửa được nữa).
//
// Ngưỡng ĐÓNG BĂNG sau khi ví đăng ký lên registry (registry v2 không có
// `set_threshold`) — copy nói thẳng, không để người dùng tự đoán.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { invitesOptions } from "@/features/family/api/invites";
import { updateRecoveryConfig, walletKeys } from "@/features/family/api/wallets";
import { RecoverabilityBanner } from "@/features/family/components/recoverability-banner";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { WizardNav } from "@/features/family/components/wizard-nav";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/setup/threshold")({
  component: SetupThresholdScreen,
});

const CHOICES = [1, 2, 3, 4, 5];

function SetupThresholdScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const [picked, setPicked] = useState<number | null>(null);

  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const threshold = picked ?? wallet?.threshold ?? 2;
  const available = invites.data?.recoverability.available ?? 0;

  const save = useMutation({
    mutationFn: () => updateRecoveryConfig({ walletId: wallet?.id ?? "", threshold }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: walletKeys.all });
      await navigate({ to: "/setup/timelock" });
    },
  });

  return (
    <ProductScreen>
      <WizardNav step={2} />
      <ScreenHeader
        title={t("setup.threshold.title")}
        description={t("setup.threshold.description")}
      />

      {walletLoading || invites.isLoading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("setup.threshold.pickTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2" role="radiogroup" aria-label={t("setup.threshold.pickTitle")}>
            {CHOICES.map((n) => (
              <Button
                key={n}
                role="radio"
                aria-checked={threshold === n}
                variant={threshold === n ? "secondary" : "ghost"}
                className="flex-1"
                onClick={() => setPicked(n)}
                data-testid={`threshold-${n}`}
              >
                {n}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {t("setup.threshold.explain", { count: threshold })}
          </p>
        </CardContent>
      </Card>

      {/* Cảnh báo theo ngưỡng ĐANG CHỌN, không theo ngưỡng đã lưu. */}
      <RecoverabilityBanner
        value={{
          available,
          threshold,
          recoverable: available >= threshold,
          missing: Math.max(0, threshold - available),
        }}
      />

      <ErrorBanner type="info" title={t("setup.threshold.pickTitle")}>
        {t("setup.threshold.frozenHint")}
      </ErrorBanner>

      {save.isError ? <ErrorBanner type="error" title={t("setup.threshold.saveFailed")} /> : null}

      <PrimaryZone>
        <Button
          loading={save.isPending}
          disabled={wallet === null}
          onClick={() => save.mutate()}
          data-testid="threshold-save"
        >
          {save.isPending ? t("setup.threshold.saving") : t("setup.threshold.nextCta")}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/setup/choose-guardians">{t("setup.threshold.backCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
