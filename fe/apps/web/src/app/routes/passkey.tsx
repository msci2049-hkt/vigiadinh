// Màn passkey — PHA 2.3: nối luồng thật (tạo passkey → smart account → SEP-45).
// Passkey = danh tính KÝ on-chain; Better Auth = phiên app. Hai lớp độc lập.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEMO_GUARDIANS, GuardianAvatarCluster } from "@/components/family/guardian-avatar-cluster";
import { Icon } from "@/components/family/icon";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { PasskeyPanel } from "@/features/wallet/components/passkey-panel";

export const Route = createFileRoute("/passkey")({ component: PasskeyScreen });

function PasskeyScreen() {
  const { t } = useTranslation("fw");
  const supported =
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof window.PublicKeyCredential !== "undefined";
  return (
    <ProductScreen className="pt-10">
      <ScreenHeader
        display
        title={t("passkey.walletUser")}
        description={supported ? t("passkey.description") : t("passkey.unsupported")}
      />
      <p className="font-mono text-muted-foreground text-sm">CAU2…XCWL</p>
      <div className="space-y-5 pt-2">
        <div className="flex items-center gap-4">
          <Icon name="lock" size={32} className="text-muted-foreground" />
          <p className="text-muted-foreground">{t("passkey.keyDevice")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Icon name="users" size={32} className="text-muted-foreground" />
          <p className="text-muted-foreground">{t("passkey.protectedBy")}</p>
        </div>
        <GuardianAvatarCluster people={DEMO_GUARDIANS} size="lg" />
        <p className="text-muted-foreground text-sm">{t("passkey.guardianNames")}</p>
      </div>
      {supported ? <PasskeyPanel /> : null}
    </ProductScreen>
  );
}
