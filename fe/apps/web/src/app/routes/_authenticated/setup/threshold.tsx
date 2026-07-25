// Bước CHỌN NGƯỠNG — cần bao nhiêu người đồng ý để mở lại ví (thay stub).
//
// Mặc định 2. Cảnh báo hiện ngay khi số người ĐÃ LÊN CHAIN nhỏ hơn ngưỡng đang
// chọn — người dùng thấy hậu quả TRƯỚC khi bấm lưu, thay vì phát hiện lúc mất
// máy (lúc đó không sửa được nữa).
//
// Ngưỡng ĐÓNG BĂNG sau khi ví đăng ký lên registry (registry v2 không có
// `set_threshold`) — copy nói thẳng, không để người dùng tự đoán.
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <WizardNav step={2} />
      <h1 className="font-semibold text-2xl text-foreground">{t("setup.threshold.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("setup.threshold.description")}</p>

      {walletLoading || invites.isLoading ? <LoadingRows /> : null}
      {walletError || invites.isError ? <ErrorState /> : null}

      <Card>
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
                variant={threshold === n ? "default" : "outline"}
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

      <p className="text-muted-foreground text-xs">{t("setup.threshold.frozenHint")}</p>

      {save.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {t("setup.threshold.saveFailed")}
        </p>
      ) : null}

      <Button
        disabled={save.isPending || wallet === null}
        onClick={() => save.mutate()}
        data-testid="threshold-save"
      >
        {save.isPending ? t("setup.threshold.saving") : t("setup.threshold.nextCta")}
      </Button>
      <Button asChild variant="ghost">
        <Link to="/setup/choose-guardians">{t("setup.threshold.backCta")}</Link>
      </Button>
    </main>
  );
}
