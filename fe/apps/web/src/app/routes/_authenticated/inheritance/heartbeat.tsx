// Màn "tôi vẫn ổn" (PHA 6): MỘT nút chạm — POST /api/inheritance/heartbeat
// reset thang nhắc thừa kế (PHA 4.3). Server không bao giờ tự mở thừa kế
// (bất biến 2) — nút này chỉ là tín hiệu sống của CHỦ VÍ.
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("inheritance.heartbeat.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("inheritance.heartbeat.description")}</p>

      {isLoading ? <LoadingRows /> : null}
      {isError ? <ErrorState /> : null}

      {wallet !== null ? (
        <Button
          size="lg"
          className="h-16 w-full max-w-xs text-lg"
          disabled={beat.isPending}
          onClick={() => beat.mutate(wallet.id)}
        >
          {t("inheritance.heartbeatButton")}
        </Button>
      ) : null}
    </main>
  );
}
