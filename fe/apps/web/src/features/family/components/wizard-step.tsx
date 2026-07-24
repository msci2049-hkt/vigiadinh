// Khung MỘT bước wizard thiết lập mức B (chọn guardian / ngưỡng / timelock / …).
// TRUNG THỰC: mức B đòi trao đổi khoá ĐA BÊN (guardian tạo passkey trên máy HỌ,
// khoá về ví chủ, deploy smart account đa-signer) — chưa dựng trong phiên này.
// Màn hiện tiêu đề/mô tả bước (cho thấy luồng dự kiến) + lối ra RÕ về mức A đang
// chạy, KHÔNG có nút giả vờ hoạt động. Custody không bị đụng.
import { Button, Card, CardContent } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function WizardStep({ title, description }: { title: string; description: string }) {
  const { t } = useTranslation("fw");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-muted-foreground text-sm">{t("setup.wizard.comingSoon")}</p>
          <Button asChild>
            <Link to="/setup">{t("setup.wizard.useSimpleCta")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
