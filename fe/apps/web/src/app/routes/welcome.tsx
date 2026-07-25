// Màn mở đầu (PHA 2.5) — public: giới thiệu VíGiaĐình bằng 3 lời hứa NGƯỜI
// THƯỜNG (không jargon) rồi dẫn sang /get-started. "Đã có ví" đi thẳng /passkey.
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";

export const Route = createFileRoute("/welcome")({ component: WelcomeScreen });

function WelcomeScreen() {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen className="pt-10">
      <ScreenHeader
        display
        title={t("welcome.title")}
        description={t("welcome.description")}
        className="max-w-sm"
      />
      <div className="relative min-h-60">
        <img
          src="/assets/people/banker-open-left.png"
          alt=""
          aria-hidden
          className="absolute -right-10 bottom-0 h-64 w-48 object-contain object-bottom"
        />
        <div className="absolute bottom-6 left-0 max-w-52 rounded-md border bg-card/95 p-4 shadow-sm">
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
