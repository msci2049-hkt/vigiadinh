// Cổng khôi phục (PUBLIC — người mất máy chưa có session, chủ ý). Giải thích
// 3 bước bằng chữ người thường rồi dẫn vào find-wallet; ai đã gửi rồi thì
// nhảy thẳng sang tiến độ (draft còn trong localStorage).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/")({ component: RecoveryStartScreen });

function RecoveryStartScreen() {
  const { t } = useTranslation("fw");
  const draft = loadRecoveryDraft();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.start.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.start.description")}</p>
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground text-sm">
        <li>{t("recovery.start.step1")}</li>
        <li>{t("recovery.start.step2")}</li>
        <li>{t("recovery.start.step3")}</li>
      </ol>
      <div className="mt-2 flex flex-col gap-2">
        <Button asChild>
          <Link to="/recovery/find-wallet">{t("recovery.start.cta")}</Link>
        </Button>
        {draft ? (
          <Button asChild variant="outline">
            <Link to="/recovery/progress" search={{ address: draft.address }}>
              {t("recovery.start.progressCta")}
            </Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
