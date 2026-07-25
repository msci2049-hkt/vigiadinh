// Khung MỘT bước wizard thiết lập mức B (chọn guardian / ngưỡng / timelock / …).
// TRUNG THỰC: mức B đòi trao đổi khoá ĐA BÊN (guardian tạo passkey trên máy HỌ,
// khoá về ví chủ, deploy smart account đa-signer) — chưa dựng trong phiên này.
// Màn hiện tiêu đề/mô tả bước (cho thấy luồng dự kiến) + lối ra RÕ về mức A đang
// chạy, KHÔNG có nút giả vờ hoạt động. Custody không bị đụng.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { IconDisc, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";

export function WizardStep({ title, description }: { title: string; description: string }) {
  const { t } = useTranslation("fw");
  return (
    <ProductScreen className="justify-center">
      <IconDisc>
        <Icon name="shieldCheck" />
      </IconDisc>
      <ScreenHeader title={title} description={description} />

      <Card className="border-dashed bg-paper-2">
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="text-copy">{t("setup.wizard.comingSoon")}</p>
          <Button asChild>
            <Link to="/setup">{t("setup.wizard.useSimpleCta")}</Link>
          </Button>
        </CardContent>
      </Card>
    </ProductScreen>
  );
}
