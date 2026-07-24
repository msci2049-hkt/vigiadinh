// Cách xử lý mất kết nối (PHA 2.2): hai bước NGƯỜI THƯỜNG — nhờ họ mở app một
// lần (tự kết nối lại) hoặc thay người khác. Không có nút "hệ thống tự sửa" nào:
// kết nối lại là hành động của CON NGƯỜI (mở app trên máy họ). Dẫn sang /waiting
// (đã nhắn, chờ) hoặc /guardians (thay người).
import { Button, Card, CardContent } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/night-watch/resolve")({
  component: NightWatchResolveScreen,
});

function NightWatchResolveScreen() {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("nightWatch.resolve.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("nightWatch.resolve.description")}</p>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex gap-3">
            <span className="font-semibold text-muted-foreground text-sm">1</span>
            <p className="text-foreground text-sm">{t("nightWatch.resolve.step1")}</p>
          </div>
          <div className="flex gap-3">
            <span className="font-semibold text-muted-foreground text-sm">2</span>
            <p className="text-foreground text-sm">{t("nightWatch.resolve.step2")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-2 flex flex-col gap-2">
        <Button asChild>
          <Link to="/night-watch/waiting">{t("nightWatch.resolve.waitingCta")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/guardians">{t("nightWatch.resolve.replaceCta")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/night-watch">{t("nightWatch.resolve.backCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
