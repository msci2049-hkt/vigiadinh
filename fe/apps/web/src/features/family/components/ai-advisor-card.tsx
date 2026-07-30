// Khối "AI bảo vệ" (lô R3 §6.5) + đường rơi về khối số liệu thô (lô R2 §5.3).
//
// AI ở đây là LỚP 3 — DIỄN ĐẠT, không bao giờ là cổng: text đến từ /explain,
// và `null` (AI tắt / thiếu key / sập / quá hạn / trả rác) nghĩa là khối AI
// biến mất, khối số thô đứng thay. Không bao giờ hiện CẢ HAI. Không skeleton:
// số thô hiện NGAY từ đầu, câu AI đến thì thay chỗ — quá 4s BE đã tự trả null.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { Button } from "@/components/family/ui";
import { useSpeak } from "@/lib/use-speak";
import { explainLocale, intentExplainOptions } from "../api/intent-explain";
import { intentSignalsOptions } from "../api/intent-signals";
import { IntentSignalsBlock, type SignalsAudience } from "./intent-signals-card";

/** Bản THUẦN — nhận text đã hoàn chỉnh (BE đã nối câu miễn trừ vào cuối).
 * Dòng dẫn tĩnh khác theo khán giả (§6.5): guardian đang quyết tiền người khác
 * → "không lấy lại được"; chủ ví đang tiêu tiền mình → "cần người thân xác
 * nhận". Dùng lại đúng hai key của khối số thô để hai khối không lệch chữ. */
export function AiExplainBlock({ text, audience }: { text: string; audience: SignalsAudience }) {
  const { t, i18n } = useTranslation("fw");
  const speech = useSpeak(i18n.language);
  const caution = t(audience === "guardian" ? "signals.finalGuardian" : "signals.finalOwner");
  // Đọc TOÀN BỘ khối: dòng dẫn + câu AI + câu miễn trừ (nằm cuối text).
  const spoken = `${caution} ${text}`;
  return (
    <section
      data-testid="ai-advisor"
      className="flex flex-col gap-2 rounded-card border border-primary bg-accent p-4 text-left"
      aria-label={t("ai.title")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <Icon name="shieldCheck" size={20} />
          {t("ai.title")}
        </h2>
        {/* Không có speechSynthesis → ẨN nút — đừng để nút bấm không kêu.
            Đọc TOÀN BỘ text (kể cả câu miễn trừ); speak() gọi NGAY trong
            handler, không await gì trước nó (iOS same-tick). */}
        {speech.supported ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="ai-speak"
            aria-label={t(speech.speaking ? "ai.stopLabel" : "ai.speakLabel")}
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(spoken))}
          >
            {speech.speaking ? "⏹" : "🔊"}
          </Button>
        ) : null}
      </div>
      <p className="font-semibold text-foreground text-sm">{caution}</p>
      <p className="whitespace-pre-line text-foreground text-sm">{text}</p>
    </section>
  );
}

/** Bản NỐI MẠNG — một chỗ quyết định hiện gì cho cả hai màn duyệt. */
export function AiAdvisorCard({
  intentId,
  audience,
}: {
  intentId: string;
  audience: SignalsAudience;
}) {
  const { i18n } = useTranslation("fw");
  const signals = useQuery(intentSignalsOptions(intentId));
  // Gác khán giả TRƯỚC khi gọi explain: chủ ví dưới ngưỡng không thấy khối nào
  // (chống mệt mỏi cảnh báo) và không tốn một lần gọi API trả tiền.
  const show = Boolean(signals.data && (audience === "guardian" || signals.data.requiresGuardian));
  const explain = useQuery({
    ...intentExplainOptions(intentId, explainLocale(i18n.language)),
    enabled: show,
  });
  if (!signals.data || !show) return null;
  const text = explain.data?.text ?? null;
  if (text) return <AiExplainBlock text={text} audience={audience} />;
  return <IntentSignalsBlock signals={signals.data} audience={audience} />;
}
