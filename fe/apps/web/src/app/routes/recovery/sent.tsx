// Bước 2: "đã gửi lời nhắn" — hiện MÃ CHÌA KHOÁ MỚI thật to để chủ ví đọc cho
// người thân qua điện thoại (đối chiếu ngoài băng — hàng rào chống tráo khoá,
// cùng mã mà guardian thấy trong app của họ trước khi mở khôi phục).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/sent")({
  validateSearch: z.object({ address: z.string().catch("") }),
  component: RecoverySentScreen,
});

function RecoverySentScreen() {
  const { t } = useTranslation("fw");
  const { address } = Route.useSearch();
  const draft = loadRecoveryDraft();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.sent.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.sent.description")}</p>
      {draft ? (
        <>
          <p className="text-muted-foreground text-xs">{t("recovery.sent.fingerprintLabel")}</p>
          <p className="break-all rounded-md bg-muted p-3 font-mono text-foreground text-sm">
            {draft.fingerprint}
          </p>
          <p className="text-muted-foreground text-xs">{t("recovery.sent.readNote")}</p>
        </>
      ) : null}
      <Button asChild className="mt-2 w-full">
        <Link to="/recovery/progress" search={{ address: address || draft?.address || "" }}>
          {t("recovery.sent.progressCta")}
        </Link>
      </Button>
    </main>
  );
}
