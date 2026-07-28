// Khối giới thiệu của trang nhận lời mời — hai thẻ "bạn giúp được gì" /
// "bạn KHÔNG làm được gì" (thẻ thứ hai quan trọng ngang thẻ đầu: nó dập tan
// đúng nỗi lo "mình cầm tiền của nó à?").
//
// Hai dạng (bug A 28/07 — trang không đổi trạng thái sau đăng nhập):
// - đầy đủ: người CHƯA đăng nhập cần đọc hết trước khi đồng ý;
// - thu gọn (<details>): người ĐÃ đăng nhập quay lại chỉ cần một dòng
//   "Xem lại bạn giúp được gì" — phần trên màn nhường chỗ cho trạng thái mới,
//   nhưng nội dung KHÔNG biến mất.
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";

const HELP_POINTS = ["guardians.accept.point2", "guardians.accept.point3"] as const;
const CANT_POINTS = [
  "guardians.accept.point1",
  "guardians.accept.cant2",
  "guardians.accept.cant3",
] as const;

function IntroCards() {
  const { t } = useTranslation("fw");
  return (
    <>
      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("guardians.accept.helpTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {HELP_POINTS.map((key) => (
              <li key={key} className="flex gap-3 text-copy">
                <Icon name="checkCircle" size={20} className="mt-0.5 shrink-0" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("guardians.accept.cantTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {CANT_POINTS.map((key) => (
              <li key={key} className="flex gap-3 text-copy">
                <Icon name="xCircle" size={20} className="mt-0.5 shrink-0" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

export function GuardianAcceptIntro({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation("fw");
  if (!collapsed) return <IntroCards />;
  return (
    <details className="rounded-card border bg-paper-2 p-4" data-testid="guardian-accept-review">
      <summary className="cursor-pointer font-semibold text-copy">
        {t("guardians.accept.reviewHelp")}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <IntroCards />
      </div>
    </details>
  );
}
