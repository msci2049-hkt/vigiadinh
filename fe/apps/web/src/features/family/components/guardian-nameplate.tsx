// Nameplate người bảo hộ — thay ảnh minh hoạ (avatar stock nói dối: sáu người
// thân của MỌI gia đình không thể cùng một bộ mặt). Nhịp thị giác giữ bằng
// khối CHỮ CÁI ĐẦU của label thật; label null (dữ liệu cũ) → rơi về chuỗi
// i18n cũ, không để trống.
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
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-full bg-primary font-semibold text-lg text-primary-foreground"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-foreground text-sm">{name}</span>
        <span className="font-mono text-muted-foreground text-xs">{shortKey(onchainKey)}</span>
      </div>
    </div>
  );
}
