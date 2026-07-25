// Thanh tiến trình wizard — cho thấy đang ở đâu trong 3 bước cấu hình.
//
// Không phải thanh "bắt buộc hoàn thành": ví đã chạy được từ trước khi vào đây,
// nên mỗi bước rời đi lúc nào cũng được. Thanh này chỉ định hướng.
import { useTranslation } from "react-i18next";

const STEPS = ["chooseGuardians", "threshold", "timelock"] as const;

export function WizardNav({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useTranslation("fw");
  return (
    <nav aria-label={t("setup.wizard.navLabel")} className="flex items-center gap-2">
      {STEPS.map((name, i) => (
        <div key={name} className="flex flex-1 flex-col gap-1">
          <div className={i < step ? "h-1 rounded-full bg-primary" : "h-1 rounded-full bg-muted"} />
          <span className="text-muted-foreground text-xs">{t(`setup.${name}.shortLabel`)}</span>
        </div>
      ))}
    </nav>
  );
}
