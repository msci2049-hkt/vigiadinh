import { Button } from "@repo/ui";
import { useTranslation } from "react-i18next";

/** Toggles UI language vi ⇄ en. The choice is persisted by the language detector. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const next = i18n.resolvedLanguage === "vi" ? "en" : "vi";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={t("language.label")}
    >
      {next.toUpperCase()}
    </Button>
  );
}
