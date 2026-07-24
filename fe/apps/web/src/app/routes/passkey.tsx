// Màn passkey — PHA 2.3: nối luồng thật (tạo passkey → smart account → SEP-45).
// Passkey = danh tính KÝ on-chain; Better Auth = phiên app. Hai lớp độc lập.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PasskeyPanel } from "@/features/wallet/components/passkey-panel";

export const Route = createFileRoute("/passkey")({ component: PasskeyScreen });

function PasskeyScreen() {
  const { t } = useTranslation("fw");
  const supported =
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof window.PublicKeyCredential !== "undefined";
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("passkey.title")}</h1>
      <p className="text-muted-foreground text-sm">
        {supported ? t("passkey.description") : t("passkey.unsupported")}
      </p>
      {supported ? <PasskeyPanel /> : null}
    </main>
  );
}
