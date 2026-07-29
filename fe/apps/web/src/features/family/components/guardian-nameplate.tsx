// Nameplate người bảo hộ — chỉ chữ, không ảnh, không khối chữ-cái-đầu (yêu cầu
// 29/07: gỡ avatar ở danh sách + chi tiết người bảo hộ + /protecting). Label
// null (dữ liệu cũ) → rơi về chuỗi i18n cũ, không để trống.
import { useTranslation } from "react-i18next";

function shortKey(key: string | null): string {
  return key ? `${key.slice(0, 4)}…${key.slice(-4)}` : "—";
}

export function GuardianNameplate({
  label,
  onchainKey,
}: {
  label: string | null;
  onchainKey: string | null;
}) {
  const { t } = useTranslation("fw");
  const name = label && label.trim() !== "" ? label : t("guardians.list.itemLabel");
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-semibold text-foreground text-sm">{name}</span>
      <span className="font-mono text-muted-foreground text-xs">{shortKey(onchainKey)}</span>
    </div>
  );
}
