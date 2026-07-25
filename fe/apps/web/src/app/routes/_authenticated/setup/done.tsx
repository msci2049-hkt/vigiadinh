// Ví đã tạo (mức A). Nhắc bước kế: thêm người bảo hộ để khôi phục được khi mất
// máy — đó là điều làm ví này khác ví thường (chưa thêm = chưa khôi phục được).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEMO_GUARDIANS, GuardianAvatarCluster } from "@/components/family/guardian-avatar-cluster";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";

export const Route = createFileRoute("/_authenticated/setup/done")({ component: SetupDoneScreen });

function SetupDoneScreen() {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen className="items-center justify-center text-center">
      <img src="/assets/mascot/mascot-wave.png" alt="" className="h-44 w-44 object-contain" />
      <ScreenHeader
        title={t("setup.done.title")}
        description={t("setup.done.description")}
        className="text-center"
      />
      <GuardianAvatarCluster people={DEMO_GUARDIANS} />
      <p className="product-copy">{t("setup.done.guardiansNote")}</p>
      <PrimaryZone className="w-full">
        <Button asChild>
          <Link to="/wallet">{t("setup.done.walletCta")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/guardians">{t("setup.done.addGuardiansCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
