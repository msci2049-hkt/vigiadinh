// KHUNG passkey (skill fw-passkey-auth): phase này chỉ feature-detect
// navigator.credentials — CHƯA tạo credential, CHƯA nối smart account.
// Passkey = danh tính KÝ on-chain; Better Auth = phiên app. Hai lớp độc lập.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/passkey")({ component: PasskeyScreen });

function PasskeyScreen() {
  const { t } = useTranslation("fw");
  const supported =
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof window.PublicKeyCredential !== "undefined";
  return (
    <ScreenStub
      title={t("passkey.title")}
      description={supported ? t("passkey.description") : t("passkey.unsupported")}
    />
  );
}
