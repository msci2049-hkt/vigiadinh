// Góc nhìn NGƯỜI BẢO HỘ về kết nối của CHÍNH HỌ (PHA 2.2): trấn an — cứ giữ app
// là đủ, họ đang "hoạt động" (có phiên = app còn cài = ladder BE thấy sống). Dẫn
// sang hộp việc cần họ (/guardian). Đây là màn phía người thân, KHÁC trang chủ
// ví thấy trạng thái NGƯỜI KHÁC — trạng thái người khác chỉ chủ ví thấy (luật 5).
import { Button, Card, CardContent } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/night-watch/guardian-view")({
  component: NightWatchGuardianViewScreen,
});

function NightWatchGuardianViewScreen() {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">
        {t("nightWatch.guardianView.title")}
      </h1>
      <p className="text-muted-foreground text-sm">{t("nightWatch.guardianView.description")}</p>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {t("nightWatch.guardianView.statusLabel")}
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-foreground text-sm">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
              {t("nightWatch.guardianView.active")}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{t("nightWatch.guardianView.lastCheck")}</p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">{t("nightWatch.guardianView.privacyNote")}</p>

      <Button asChild variant="outline">
        <Link to="/guardian">{t("nightWatch.guardianView.inboxCta")}</Link>
      </Button>
    </main>
  );
}
