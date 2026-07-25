// Cách xử lý mất kết nối (PHA 2.2): hai bước NGƯỜI THƯỜNG — nhờ họ mở app một
// lần (tự kết nối lại) hoặc thay người khác. Không có nút "hệ thống tự sửa" nào:
// kết nối lại là hành động của CON NGƯỜI (mở app trên máy họ). Dẫn sang /waiting
// (đã nhắn, chờ) hoặc /guardians (thay người).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";

export const Route = createFileRoute("/_authenticated/night-watch/resolve")({
  component: NightWatchResolveScreen,
});

function NightWatchResolveScreen() {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen>
      <ScreenHeader
        title={t("nightWatch.resolve.title")}
        description={t("nightWatch.resolve.description")}
      />

      <Card className="bg-paper-2">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
              <Icon name="refresh" size={20} />
            </span>
            <p className="text-copy">{t("nightWatch.resolve.step1")}</p>
          </div>
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
              <Icon name="userPlus" size={20} />
            </span>
            <p className="text-copy">{t("nightWatch.resolve.step2")}</p>
          </div>
        </CardContent>
      </Card>

      <PrimaryZone>
        <Button asChild>
          <Link to="/night-watch/waiting">{t("nightWatch.resolve.waitingCta")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/guardians">{t("nightWatch.resolve.replaceCta")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/night-watch">{t("nightWatch.resolve.backCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
