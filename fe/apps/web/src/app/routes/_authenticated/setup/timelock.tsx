// Bước CHỌN THỜI GIAN CHỜ — cửa sổ để chủ ví kịp chặn nếu ai đó mở khôi phục
// mà họ không hề yêu cầu (thay stub).
//
// Handoff chốt 24h cố định; ux-v2 cho chọn. Chọn: CHO CHỌN, mặc định 24h —
// đánh đổi ở đây là thật (chờ lâu = an toàn hơn nhưng cứu ví chậm hơn), người
// dùng nên tự cân.
//
// CHỈ được cho chọn TỪ 24h TRỞ LÊN. Registry cưỡng chế sàn `MIN_TIMELOCK_SECS`
// = 86_400 on-chain (vá audit P0-2) — thấp hơn là `register_wallet` panic
// `#17 TimelockTooShort` ở bước CUỐI wizard, sau khi người dùng đã làm xong
// ceremony passkey. Danh sách lấy từ `TIMELOCK_CHOICES_SECS`, đừng thêm tay.
//
// Ba lựa chọn khớp `TIMELOCK_CHOICES_SECS` của BE — BE là nơi cưỡng chế; danh
// sách ở đây chỉ để dựng nút.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import {
  TIMELOCK_CHOICES_SECS,
  timelockLabelKey,
  updateRecoveryConfig,
  walletKeys,
} from "@/features/family/api/wallets";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { WizardNav } from "@/features/family/components/wizard-nav";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/setup/timelock")({
  component: SetupTimelockScreen,
});

function SetupTimelockScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wallet, isLoading, isError } = useActiveWallet();
  const [picked, setPicked] = useState<number | null>(null);

  const timelockSecs = picked ?? wallet?.timelockSecs ?? 86400;

  const save = useMutation({
    mutationFn: () => updateRecoveryConfig({ walletId: wallet?.id ?? "", timelockSecs }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: walletKeys.all });
      await navigate({ to: "/setup/review" });
    },
  });

  return (
    <ProductScreen>
      <WizardNav step={3} />
      <ScreenHeader
        title={t("setup.timelock.title")}
        description={t("setup.timelock.description")}
      />

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("setup.timelock.pickTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label={t("setup.timelock.pickTitle")}
          >
            {TIMELOCK_CHOICES_SECS.map((secs) => (
              <Button
                key={secs}
                role="radio"
                aria-checked={timelockSecs === secs}
                variant={timelockSecs === secs ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setPicked(secs)}
                data-testid={`timelock-${secs}`}
              >
                {t(timelockLabelKey(secs))}
              </Button>
            ))}
          </div>
          {/* Đánh đổi nói thẳng — đây là thứ người dùng thật sự đang chọn. */}
          <p className="text-muted-foreground text-sm">{t("setup.timelock.tradeoff")}</p>
        </CardContent>
      </Card>

      {save.isError ? <ErrorBanner type="error" title={t("setup.timelock.saveFailed")} /> : null}

      <PrimaryZone>
        <Button
          loading={save.isPending}
          disabled={wallet === null}
          onClick={() => save.mutate()}
          data-testid="timelock-save"
        >
          {save.isPending ? t("setup.timelock.saving") : t("setup.timelock.nextCta")}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/setup/threshold">{t("setup.timelock.backCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
