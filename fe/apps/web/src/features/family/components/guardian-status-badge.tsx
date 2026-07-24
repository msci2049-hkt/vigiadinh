// Chip trạng thái người thân — chữ NGƯỜI THƯỜNG qua i18n (cấm jargon guardian/
// presence trong UI — luật CLAUDE.md 4). Màu: active xanh (mặc định secondary),
// slow vàng-ish (outline), offline/removed đỏ nhạt (destructive).
import { Badge } from "@repo/ui";
import { useTranslation } from "react-i18next";
import type { GuardianStatus } from "../api/guardians";

const VARIANT: Record<GuardianStatus, "default" | "secondary" | "destructive" | "outline"> = {
  invited: "outline",
  active: "default",
  slow: "secondary",
  offline: "destructive",
  removed: "outline",
};

export function GuardianStatusBadge({ status }: { status: GuardianStatus }) {
  const { t } = useTranslation("fw");
  return <Badge variant={VARIANT[status]}>{t(`guardians.status.${status}`)}</Badge>;
}
