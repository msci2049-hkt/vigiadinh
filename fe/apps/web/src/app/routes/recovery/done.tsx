// Kết thúc luồng máy mới: ví đã về khoá mới TRÊN CHAIN — nút "mở ví trên máy
// này" nối kit vào ĐÚNG địa chỉ ví cũ bằng credential đã tạo lúc gõ cửa
// (địa chỉ không đổi, tiền không di chuyển — audit P0). Lưu ý cooldown: ngay
// sau khôi phục ví từ chối MỌI chữ ký một thời gian ngắn — hành vi đúng.

import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { connectRecoveredWallet, loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/done")({
  validateSearch: z.object({ address: z.string().catch("") }),
  component: RecoveryDoneScreen,
});

function RecoveryDoneScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const { address } = Route.useSearch();
  const draft = loadRecoveryDraft();

  const connect = useMutation({
    mutationFn: async () => connectRecoveredWallet(),
    onSuccess: async () => {
      await navigate({ to: "/passkey" });
    },
  });

  return (
    <ProductScreen>
      <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <Icon name="checkCircle" size={32} />
      </div>
      <ScreenHeader title={t("recovery.done.title")} description={t("recovery.done.description")} />
      {address ? (
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <p className="text-muted-foreground text-sm">{t("recovery.done.sameAddress")}</p>
          <p className="mt-2 font-mono text-sm">{`${address.slice(0, 4)}…${address.slice(-4)}`}</p>
        </div>
      ) : null}
      <ErrorBanner type="warn" title={t("recovery.done.cooldownTitle")}>
        {t("recovery.done.cooldownNote")}
      </ErrorBanner>
      {connect.isError ? (
        <ErrorBanner type="error" title={t("recovery.done.errorTitle")}>
          {t("recovery.done.errors.noDraft")}
        </ErrorBanner>
      ) : null}
      <PrimaryZone>
        {draft ? (
          <Button
            className="w-full"
            loading={connect.isPending}
            loadingLabel={t("passkey.working")}
            onClick={() => connect.mutate()}
          >
            {t("recovery.done.connectCta")}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/passkey">{t("recovery.done.openWalletCta")}</Link>
          </Button>
        )}
      </PrimaryZone>
    </ProductScreen>
  );
}
