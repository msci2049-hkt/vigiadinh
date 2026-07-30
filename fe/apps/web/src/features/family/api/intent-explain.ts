// "AI bảo vệ" (lô R3) — POST /api/intents/:id/explain. BE trả text (đã hậu
// kiểm + nối câu miễn trừ) hoặc null khi AI tắt/sập/quá hạn/trả rác. Null
// KHÔNG phải lỗi: nó là tín hiệu "hiện khối số liệu thô" — vì vậy retry: false,
// đường rơi đã có sẵn, gọi lại chỉ đốt tiền API.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type ExplainLocale = "vi" | "en" | "zh";
export type IntentExplain = { text: string | null };

/** i18n.language ("vi", "zh-CN"…) → locale explain; ngoài bộ 3 thì về en. */
export function explainLocale(language: string): ExplainLocale {
  const base = language.toLowerCase().split("-")[0];
  return base === "vi" || base === "zh" ? base : "en";
}

export const intentExplainKeys = {
  all: ["family", "intent-explain"] as const,
  detail: (intentId: string, locale: ExplainLocale) =>
    [...intentExplainKeys.all, intentId, locale] as const,
};

export const intentExplainOptions = (intentId: string, locale: ExplainLocale) =>
  queryOptions({
    queryKey: intentExplainKeys.detail(intentId, locale),
    queryFn: async () => {
      const res = await apiClient.post<{ data: IntentExplain }>(
        `/api/intents/${intentId}/explain`,
        { locale },
      );
      return res.data;
    },
    // BE cache 1h theo (intentId, locale) — cùng lệnh phải ra CÙNG một câu,
    // guardian mở lại màn không được thấy câu khác.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
