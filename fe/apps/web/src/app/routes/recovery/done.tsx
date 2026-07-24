// Kết thúc luồng máy mới: ví đã về khoá mới TRÊN CHAIN — nút "mở ví trên máy
// này" nối kit vào ĐÚNG địa chỉ ví cũ bằng credential đã tạo lúc gõ cửa
// (địa chỉ không đổi, tiền không di chuyển — audit P0). Lưu ý cooldown: ngay
// sau khôi phục ví từ chối MỌI chữ ký một thời gian ngắn — hành vi đúng.
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { connectRecoveredWallet, loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/done")({
  validateSearch: z.object({ address: z.string().catch("") }),
  component: RecoveryDoneScreen,
});

function RecoveryDoneScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const draft = loadRecoveryDraft();

  const connect = useMutation({
    mutationFn: async () => connectRecoveredWallet(),
    onSuccess: async () => {
      await navigate({ to: "/passkey" });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.done.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.done.description")}</p>
      <p className="text-muted-foreground text-xs">{t("recovery.done.cooldownNote")}</p>

      {connect.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {t("recovery.done.errors.noDraft")}
        </p>
      ) : null}

      {draft ? (
        <Button
          className="mt-2 w-full"
          disabled={connect.isPending}
          onClick={() => connect.mutate()}
        >
          {t("recovery.done.connectCta")}
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-2 w-full">
          <Link to="/passkey">{t("recovery.done.openWalletCta")}</Link>
        </Button>
      )}
    </main>
  );
}
