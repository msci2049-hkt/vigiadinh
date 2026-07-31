// Lô R5 §4 — phiên ví hết hạn khi bấm ký: KHÔNG phải lỗi đỏ, là một bước xác
// nhận lại. Hiện nút để người dùng chạm vân tay (WebAuthn đòi cử chỉ — cấm tự
// chạy ngầm); hết lượt (đã thử lại một lần mà vẫn hỏng) mới chuyển giọng cảnh báo.
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "./error-banner";
import { Icon } from "./icons";
import { Button } from "./ui";

export function ReconfirmSign({
  phase,
  onStart,
}: {
  phase: "idle" | "busy" | "exhausted";
  onStart: () => void;
}) {
  const { t } = useTranslation("fw");
  if (phase === "exhausted") {
    return <ErrorBanner type="warn" title={t("walletSession.reconfirmFailed")} />;
  }
  return (
    <ErrorBanner type="info" title={t("walletSession.reconfirm.title")}>
      <Button loading={phase === "busy"} onClick={onStart} className="mt-2">
        <Icon name="fingerprint" />
        {t("walletSession.reconfirm.cta")}
      </Button>
    </ErrorBanner>
  );
}
