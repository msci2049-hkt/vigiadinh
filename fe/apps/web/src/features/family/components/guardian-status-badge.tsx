// Chip trạng thái người thân — chữ NGƯỜI THƯỜNG qua i18n (cấm jargon guardian/
// presence trong UI — luật CLAUDE.md 4). Màu: active xanh (mặc định secondary),
// slow vàng-ish (outline), offline/removed đỏ nhạt (destructive).
import { useTranslation } from "react-i18next";
import { StatusPill } from "@/components/family/status-pill";
import type { GuardianStatus } from "../api/guardians";

const STATE: Record<GuardianStatus, "active" | "slow" | "offline" | "pending"> = {
  invited: "pending",
  active: "active",
  slow: "slow",
  offline: "offline",
  removed: "offline",
};

export function GuardianStatusBadge({ status }: { status: GuardianStatus }) {
  const { t } = useTranslation("fw");
  return <StatusPill state={STATE[status]}>{t(`guardians.status.${status}`)}</StatusPill>;
}
