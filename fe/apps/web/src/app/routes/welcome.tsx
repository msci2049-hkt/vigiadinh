// Màn mở đầu (PHA 2.5) — public: giới thiệu VíGiaĐình bằng 3 lời hứa NGƯỜI
// THƯỜNG (không jargon) rồi dẫn sang /get-started. "Đã có ví" đi thẳng /passkey.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";

export const Route = createFileRoute("/welcome")({ component: WelcomeScreen });

function WelcomeScreen() {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen className="welcome-screen pt-5">
      <ScreenHeader
        display
        title={t("welcome.title")}
        description={t("welcome.description")}
        className="max-w-sm"
      />
      <div className="welcome-hero">
        <ProductImage
          src="/assets/characters/european-family-hero.png"
          webpSrc="/assets/characters/european-family-hero.webp"
          alt=""
          width={1122}
          height={1402}
          priority
          aria-hidden
          className="welcome-family"
        />
        <div className="welcome-promise">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Icon name="shieldCheck" size={20} />
            {t("welcome.point2")}
          </div>
        </div>
      </div>
      <PrimaryZone>
        <Button asChild>
          <Link to="/get-started">{t("welcome.cta")}</Link>
        </Button>
        <Button asChild variant="link">
          <Link to="/passkey">{t("welcome.haveCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
