// Câu trả lời thật cho "ví này cứu được chưa" — hiện ở hub và màn mời.
//
// Vì sao đây là component riêng và hiện ở nhiều nơi: kịch bản tệ nhất của sản
// phẩm là người dùng TƯỞNG mình an toàn ("đã mời 3 người rồi") trong khi chưa ai
// nhận lời — và chỉ phát hiện đúng lúc mất máy, tức là lúc không sửa được nữa.
// Đếm theo người ĐÃ LÊN CHAIN, không đếm lời mời đã gửi.

import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import type { Recoverability } from "../api/invites";

export function RecoverabilityBanner({ value }: { value: Recoverability }) {
  const { t } = useTranslation("fw");

  if (value.recoverable) {
    return (
      <div data-testid="recoverability-ok">
        <ErrorBanner
          type="info"
          title={t("guardians.recoverability.ok", { count: value.available })}
        />
      </div>
    );
  }

  return (
    <div data-testid="recoverability-warning">
      <ErrorBanner type="warn" title={t("guardians.recoverability.notYetTitle")}>
        {t("guardians.recoverability.notYetBody", {
          available: value.available,
          threshold: value.threshold,
          missing: value.missing,
        })}
      </ErrorBanner>
    </div>
  );
}
