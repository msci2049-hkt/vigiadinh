// Góc nhìn NGƯỜI BẢO HỘ về kết nối của CHÍNH HỌ (PHA 2.2): trấn an — cứ giữ app
// là đủ, họ đang "hoạt động" (có phiên = app còn cài = ladder BE thấy sống). Dẫn
// sang hộp việc cần họ (/guardian). Đây là màn phía người thân, KHÁC trang chủ
// ví thấy trạng thái NGƯỜI KHÁC — trạng thái người khác chỉ chủ ví thấy (luật 5).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { StatusPill } from "@/components/family/status-pill";
import { Button, Card, CardContent } from "@/components/family/ui";

export const Route = createFileRoute("/_authenticated/night-watch/guardian-view")({
  component: NightWatchGuardianViewScreen,
});

function NightWatchGuardianViewScreen() {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen className="justify-center">
      <ProductImage
        src="/assets/characters/european-family-hero.png"
        webpSrc="/assets/characters/european-family-hero.webp"
        alt=""
        width={1122}
        height={1402}
        priority
        className="family-scene family-scene--compact"
      />
      <ScreenHeader
        title={t("nightWatch.guardianView.title")}
        description={t("nightWatch.guardianView.description")}
      />

      <Card className="bg-paper-2">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {t("nightWatch.guardianView.statusLabel")}
            </span>
            <StatusPill state="active">{t("nightWatch.guardianView.active")}</StatusPill>
          </div>
          <p className="text-muted-foreground text-xs">{t("nightWatch.guardianView.lastCheck")}</p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">{t("nightWatch.guardianView.privacyNote")}</p>

      <PrimaryZone>
        <Button asChild>
          <Link to="/guardian">{t("nightWatch.guardianView.inboxCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
