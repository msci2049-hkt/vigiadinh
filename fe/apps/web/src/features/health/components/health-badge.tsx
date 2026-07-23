// 🧪 DEMO FEATURE (features/health) — safe to delete the whole folder. See README "Gỡ demo".

import { Badge } from "@repo/ui";
import { useTranslation } from "react-i18next";
import { useHealth } from "../hooks/use-health";

/** Live BE connection indicator (pings /health). */
export function HealthBadge() {
  const { data, isPending, isError } = useHealth();
  const { t } = useTranslation("common");

  if (isPending) {
    return <Badge variant="outline">{t("health.checking")}</Badge>;
  }
  if (isError || !data?.ok) {
    return <Badge variant="destructive">{t("health.disconnected")}</Badge>;
  }
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{t("health.ok")}</Badge>;
}
