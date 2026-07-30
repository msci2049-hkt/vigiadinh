// Lô R3 — dàn nhạc của POST /:id/explain. Toàn bộ đường này FAIL-SAFE:
// mọi nhánh lỗi (tắt cờ, thiếu key, cache chết, API sập, quá hạn, output rác)
// đều hội tụ về `null` — FE thấy null thì hiện khối số liệu thô của lớp 2.
// KHÔNG retry (DeepSeek 503 giờ cao điểm + màn hình chỉ chờ 4s), KHÔNG throw
// ra ngoài. Deps tiêm được để test không chạm mạng.
import type { IntentSignals } from "../signals/domain";
import {
  buildUserMessage,
  DISCLAIMERS,
  type ExplainLocale,
  passesPostCheck,
  SYSTEM_PROMPT,
} from "./domain";

export type ExplainDeps = {
  /** AI_ADVISOR_ENABLED && có DEEPSEEK_API_KEY — false thì trả null NGAY, 0 lần gọi API. */
  enabled: boolean;
  /** 4000ms production — test vặn nhỏ để đo đường timeout. */
  timeoutMs: number;
  cacheGet(key: string): Promise<string | null>;
  cacheSet(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Gọi model. Throw trên mọi lỗi — service đổi mọi throw thành null. */
  complete(args: { system: string; user: string; signal: AbortSignal }): Promise<string>;
};

export const EXPLAIN_CACHE_TTL_SECONDS = 3600;

/** Cache theo (intentId, locale): cùng một lệnh mở lại phải ra CÙNG MỘT CÂU —
 * guardian đọc lại qua điện thoại không được thấy câu khác. */
export function explainCacheKey(intentId: string, locale: ExplainLocale): string {
  return `explain:v1:${intentId}:${locale}`;
}

export async function explainIntentSignals(
  deps: ExplainDeps,
  input: {
    intentId: string;
    locale: ExplainLocale;
    signals: IntentSignals;
    ownerName: string | null;
  },
): Promise<string | null> {
  if (!deps.enabled) return null;

  const key = explainCacheKey(input.intentId, input.locale);
  // Cache chết ≠ tính năng chết: lỗi cache coi như miss, đi tiếp.
  const cached = await deps.cacheGet(key).catch(() => null);
  if (cached) return cached;

  const user = buildUserMessage({
    locale: input.locale,
    signals: input.signals,
    ownerName: input.ownerName,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  let raw: string;
  try {
    raw = await deps.complete({ system: SYSTEM_PROMPT, user, signal: controller.signal });
  } catch {
    return null; // timeout / 5xx / hình lệch — MỘT lần gọi, không hơn
  } finally {
    clearTimeout(timer);
  }

  if (!passesPostCheck(raw, user)) return null;

  // Câu miễn trừ do BE nối — phải LUÔN có, model không được tin để tự thêm.
  const text = `${raw.trim()} ${DISCLAIMERS[input.locale]}`;
  await deps.cacheSet(key, text, EXPLAIN_CACHE_TTL_SECONDS).catch(() => {});
  return text;
}
