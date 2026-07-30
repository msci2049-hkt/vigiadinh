// Khối "Kiểm tra trước khi duyệt" (lô R2 §5.3) — SỐ LIỆU THÔ từ SQL, KHÔNG LLM.
// Đây là fallback THẬT, không phải placeholder: AI (pha 3) tắt/sập/quá hạn thì
// khối này vẫn hiện đầy đủ và nút duyệt vẫn bấm được.
//
// Chỗ đặt (§5.4): màn guardian duyệt hiện LUÔN — guardian đang quyết tiền của
// người khác. Màn chủ ví CHỈ hiện khi requiresGuardian: hiện ở mọi lần gửi thì
// sau 20 lần người dùng bấm qua theo phản xạ và lần thứ 21 — lần có vấn đề —
// cũng bấm qua (mệt mỏi cảnh báo làm GIẢM bảo mật). Dưới ngưỡng thì im.
import { formatAmount } from "@repo/core";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import type { IntentSignals } from "../api/intent-signals";

export type SignalsAudience = "guardian" | "owner";

/** Bản THUẦN — nhận số liệu, không mạng: test render trực tiếp được. */
export function IntentSignalsBlock({
  signals,
  audience,
}: {
  signals: IntentSignals;
  audience: SignalsAudience;
}) {
  const { t, i18n } = useTranslation("fw");
  if (audience === "owner" && !signals.requiresGuardian) return null;

  // Thập phân theo locale (3,0 vi · 3.0 en) — format ở JS, i18n chỉ nhận chuỗi.
  const ratio =
    signals.ratioToAvg === null
      ? null
      : new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(signals.ratioToAvg);

  return (
    <section
      data-testid="intent-signals"
      className="flex flex-col gap-2 rounded-card border border-primary bg-accent p-4 text-left"
      aria-label={t(audience === "guardian" ? "signals.title" : "signals.titleOwner")}
    >
      <h2 className="flex items-center gap-2 font-semibold text-foreground text-sm">
        <Icon name="alertTriangle" size={20} />
        {t(audience === "guardian" ? "signals.title" : "signals.titleOwner")}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {ratio !== null ? (
          <li className="text-foreground text-sm">{t("signals.ratio", { ratio })}</li>
        ) : null}
        <li className="text-foreground text-sm">
          {signals.recipientSettledCount === 0
            ? t("signals.firstTime")
            : t("signals.sentBefore", { count: signals.recipientSettledCount })}
        </li>
        <li className="text-foreground text-sm">
          {t("signals.velocity", {
            count: signals.txCountLastHour,
            total: formatAmount(signals.totalLastHour, { locale: i18n.language, code: "XLM" }),
          })}
        </li>
      </ul>
      <p className="font-semibold text-foreground text-sm">
        {t(audience === "guardian" ? "signals.finalGuardian" : "signals.finalOwner")}
      </p>
    </section>
  );
}

// Bản nối mạng nằm ở ai-advisor-card.tsx (AiAdvisorCard) — một chỗ quyết định
// hiện khối AI hay khối số thô, để hai màn duyệt không bao giờ lệch nhau.
