// Cài đặt tối thiểu (C18) — ngôn ngữ + tài khoản + về app. CỐ Ý không nhét
// quản lý passkey/thiết bị vào đây (C19 — cần luồng multi-device riêng, ghi nợ).
// Đổi mật khẩu đi qua luồng OTP CÓ SẴN (/forgot-password) — không chế luồng mới.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/components/family/product-shell";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { env } from "@/lib/env";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const { t, i18n } = useTranslation("fw");
  const { user } = useCurrentUser();
  const active = i18n.resolvedLanguage ?? "en";
  const isTestnet = env.VITE_STELLAR_NETWORK_PASSPHRASE.startsWith("Test ");

  return (
    <ProductScreen>
      <ScreenHeader title={t("settings.title")} description={t("settings.description")} />

      {/* Ngôn ngữ — cùng danh sách với chrome (một nguồn). Chrome GIỮ switcher:
          giám khảo đổi ngôn ngữ một chạm ở mọi màn; đây là bản đầy đủ có nhãn. */}
      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("settings.language.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label={t("settings.language.title")}
          >
            {LANGUAGES.map((language) => (
              <Button
                key={language.code}
                role="radio"
                aria-checked={active === language.code}
                variant={active === language.code ? "secondary" : "ghost"}
                onClick={() => void i18n.changeLanguage(language.code)}
              >
                {language.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tài khoản — email đang đăng nhập + đổi mật khẩu qua OTP có sẵn. */}
      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("settings.account.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="break-all text-copy">{user?.email ?? "—"}</p>
          <Button asChild variant="ghost" className="justify-start">
            <Link to="/forgot-password">{t("settings.account.changePassword")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Về app — tên + mạng đang chạy. Nói THẲNG là mạng thử: tiền ở đây
          không phải tiền thật, người dùng phải biết điều đó ở màn cài đặt. */}
      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("settings.about.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-copy">
          <p>{env.VITE_APP_NAME}</p>
          <p className="text-muted-foreground text-sm">
            {isTestnet ? t("settings.about.testnet") : t("settings.about.mainnet")}
          </p>
        </CardContent>
      </Card>
    </ProductScreen>
  );
}
