import { Button } from "@repo/ui";
import { useTranslation } from "react-i18next";

// Vòng ngôn ngữ en → vi → zh → en. Lựa chọn được language detector lưu localStorage.
// Nhãn nút = ngôn ngữ KẾ TIẾP (bấm để đổi sang nó).
const CYCLE = ["en", "vi", "zh"] as const;
const LABEL: Record<(typeof CYCLE)[number], string> = { en: "EN", vi: "VI", zh: "中" };

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? "en") as (typeof CYCLE)[number];
  const idx = CYCLE.indexOf(current);
  const next = CYCLE[(idx + 1) % CYCLE.length] ?? "en";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={t("language.label")}
    >
      {LABEL[next]}
    </Button>
  );
}
