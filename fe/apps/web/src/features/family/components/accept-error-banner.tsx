// Lỗi ở bước "nhận lời làm người bảo hộ" — mỗi nguyên nhân một câu + lối thoát.
//
// Trước bản này cả bốn nguyên nhân (phiên hết hạn · link chết · link đã dùng ·
// passkey hỏng trên máy) đều ra chung một câu "Chưa tải được mục này. Kéo để làm
// mới hoặc thử lại sau ít phút." — câu đó chỉ đúng cho lỗi mạng, và người thân
// đứng đó kéo làm mới mãi không đi tới đâu.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Button } from "@/components/family/ui";
import type { AcceptErrorView } from "../lib/accept-error";

export function AcceptErrorBanner({
  view,
  /** Quay lại đúng link mời sau khi đăng nhập — mất token là mất luôn lời mời. */
  redirectBack,
}: {
  view: AcceptErrorView;
  redirectBack: string;
}) {
  const { t } = useTranslation("fw");
  return (
    <div className="flex flex-col gap-2" data-testid="guardian-accept-error">
      <ErrorBanner type="error" title={t(view.title)}>
        <p>{t(view.body)}</p>
        {view.code ? (
          <p className="mt-1 text-xs opacity-70" data-testid="guardian-accept-error-code">
            {t("guardians.accept.errTechnical", { code: view.code })}
          </p>
        ) : null}
      </ErrorBanner>
      {view.action === "login" ? (
        <Button asChild variant="secondary" data-testid="guardian-accept-error-login">
          <Link to="/login" search={{ redirect: redirectBack }}>
            {t("guardians.accept.errLoginCta")}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
