// Ngã ba mở đầu (PHA 2.5) — public: tạo ví mới (cần phiên app để mirror ví →
// /sign-up rồi /setup) HOẶC mở ví đã có trên máy này (/passkey — connect + đăng
// nhập SEP-45, không cần email).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type FamilyIconName, Icon } from "@/components/family/icon";
import { IconDisc, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";

export const Route = createFileRoute("/get-started")({ component: GetStartedScreen });

function GetStartedScreen() {
  const { t } = useTranslation("fw");
  const benefits: { icon: FamilyIconName; title: string; body: string }[] = [
    {
      icon: "fingerprint",
      title: t("getStarted.benefit1Title"),
      body: t("getStarted.benefit1Body"),
    },
    {
      icon: "users",
      title: t("getStarted.benefit2Title"),
      body: t("getStarted.benefit2Body"),
    },
    {
      icon: "shieldCheck",
      title: t("getStarted.benefit3Title"),
      body: t("getStarted.benefit3Body"),
    },
  ];
  return (
    <ProductScreen>
      <ScreenHeader title={t("getStarted.title")} description={t("getStarted.description")} />
      <div className="space-y-3">
        {benefits.map((benefit) => (
          <Card key={benefit.icon}>
            <CardContent className="flex items-start gap-4">
              <IconDisc>
                <Icon name={benefit.icon} size={20} />
              </IconDisc>
              <div>
                <h2 className="font-semibold text-base">{benefit.title}</h2>
                <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{benefit.body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PrimaryZone>
        <Button asChild>
          <Link to="/sign-up">{t("getStarted.createCta")}</Link>
        </Button>
        <Button asChild variant="link">
          <Link to="/passkey">{t("getStarted.haveCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
