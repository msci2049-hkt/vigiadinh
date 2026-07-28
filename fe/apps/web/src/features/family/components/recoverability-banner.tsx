// Câu trả lời thật cho "ví này cứu được chưa" — hiện ở hub và màn mời.
//
// Vì sao đây là component riêng và hiện ở nhiều nơi: kịch bản tệ nhất của sản
// phẩm là người dùng TƯỞNG mình an toàn ("đã mời 3 người rồi") trong khi chưa ai
// nhận lời — và chỉ phát hiện đúng lúc mất máy, tức là lúc không sửa được nữa.
// Đếm theo người ĐÃ LÊN CHAIN, không đếm lời mời đã gửi.

import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { MIN_GUARDIANS } from "@/lib/auth-entry-guard";
import type { Recoverability } from "../api/invites";

export function RecoverabilityBanner({ value }: { value: Recoverability }) {
  const { t } = useTranslation("fw");
  // Fallback cùng công thức BE: BE bản cũ chưa trả `required` (deploy BE cần
  // root, có thể đi SAU FE) — thiếu fallback là banner hiện "undefined người".
  const required = value.required ?? Math.max(MIN_GUARDIANS, value.threshold);
  const missing = value.missing || Math.max(0, required - value.available);

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
        {/* HAI con số, HAI khái niệm — trộn là ra bug "0 trên 2": required
            (≥3) = số người phải NHẬN LỜI; threshold = số người KÝ khi cứu ví. */}
        {t("guardians.recoverability.notYetBody", {
          available: value.available,
          required,
          threshold: value.threshold,
          missing,
        })}
      </ErrorBanner>
    </div>
  );
}
