// Banner lỗi của đường GỬI TIỀN — câu riêng cho từng nguyên nhân + LỐI THOÁT.
//
// Vì sao có nút đi kèm: lỗi không có đường đi tiếp là ngõ cụt. "Ví chưa được bảo
// vệ" mà không có nút mời người thân thì người dùng phải tự đoán ra rằng cái cần
// làm nằm ở một màn khác — đúng cái đã xảy ra ngày 29/07.
//
// Mã kỹ thuật chỉ hiện khi KHÔNG map được: người thường không cần đọc nó, nhưng
// khi có nó thì việc chẩn đoán từ một ảnh chụp màn hình mất 30 giây thay vì một giờ.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Button } from "@/components/family/ui";
import type { SendErrorView } from "../lib/send-error";

export function SendErrorBanner({
  view,
  protectTo,
  onStartOver,
}: {
  view: SendErrorView;
  /** Đích của nút "bảo vệ ví" — màn gọi biết ví đang thiếu người hay thiếu bước cuối. */
  protectTo: "/setup/choose-guardians" | "/setup/review";
  /** Chỉ màn review có đường "làm lại từ đầu" (reset máy trạng thái + form). */
  onStartOver?: (() => void) | undefined;
}) {
  const { t } = useTranslation("fw");
  return (
    <div className="flex flex-col gap-2" data-testid="send-error">
      <ErrorBanner type="error" title={t(view.title, { shortfall: view.shortfall ?? "" })}>
        {view.body ? <p>{t(view.body)}</p> : null}
        {view.code ? (
          <p className="mt-1 text-xs opacity-70" data-testid="send-error-code">
            {t("wallet.send.errors.technical", { code: view.code })}
          </p>
        ) : null}
      </ErrorBanner>

      {view.action === "protect" ? (
        <Button asChild variant="secondary" data-testid="send-error-protect">
          <Link to={protectTo}>{t("wallet.send.errors.protectCta")}</Link>
        </Button>
      ) : null}
      {view.action === "safety" ? (
        <Button asChild variant="secondary" data-testid="send-error-safety">
          <Link to="/settings">{t("wallet.send.errors.safetyCta")}</Link>
        </Button>
      ) : null}
      {view.action === "startOver" && onStartOver ? (
        <Button variant="secondary" onClick={onStartOver} data-testid="send-error-startover">
          {t("wallet.send.startOverCta")}
        </Button>
      ) : null}
    </div>
  );
}
