// Ví đã tạo (mức A). Nhắc bước kế: thêm người bảo hộ để khôi phục được khi mất
// máy — đó là điều làm ví này khác ví thường (chưa thêm = chưa khôi phục được).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/setup/done")({ component: SetupDoneScreen });

function SetupDoneScreen() {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("setup.done.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("setup.done.description")}</p>
      <p className="text-muted-foreground text-sm">{t("setup.done.guardiansNote")}</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button asChild>
          <Link to="/wallet">{t("setup.done.walletCta")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/guardians">{t("setup.done.addGuardiansCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
