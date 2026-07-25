// Màn "tôi vẫn ổn" (PHA 6): MỘT nút chạm — POST /api/inheritance/heartbeat
// reset thang nhắc thừa kế (PHA 4.3). Server không bao giờ tự mở thừa kế
// (bất biến 2) — nút này chỉ là tín hiệu sống của CHỦ VÍ.
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { sendHeartbeat } from "@/features/family/api/inheritance";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/inheritance/heartbeat")({
  component: InheritanceHeartbeatScreen,
});

function InheritanceHeartbeatScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  const beat = useMutation({
    mutationFn: (walletId: string) => sendHeartbeat(walletId),
    onSuccess: () => toast.success(t("inheritance.heartbeatDone")),
    onError: () => toast.error(t("state.error")),
  });

  return (
    <ProductScreen className="items-center justify-center text-center">
      <span className="grid size-24 place-items-center rounded-full bg-primary">
        <Icon name="heart" size={32} />
      </span>
      <ScreenHeader
        title={t("inheritance.heartbeat.title")}
        description={t("inheritance.heartbeat.description")}
        className="text-center"
      />

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      {wallet !== null ? (
        <PrimaryZone className="w-full">
          <Button size="lg" loading={beat.isPending} onClick={() => beat.mutate(wallet.id)}>
            <Icon name="heart" />
            {t("inheritance.heartbeatButton")}
          </Button>
        </PrimaryZone>
      ) : null}
    </ProductScreen>
  );
}
