// DeepSeek client (lô R3) — fetch trần + AbortController, CỐ Ý lệch khuôn
// call-external-api (ofetch retry + cockatiel breaker) vì spec đường này cấm:
//
// 🔴 KHÔNG retry. Hạ tầng DeepSeek 503 giờ cao điểm; đường gọi này đứng sau
// một màn hình đang chờ tối đa 4 giây. Retry là đốt thêm thời gian chờ để tăng
// xác suất một TIỆN ÍCH — trong khi thiết kế fail-safe đã có sẵn đường rơi
// (trả null → FE hiện khối số thô). Lỗi đầu tiên = null luôn.
//
// 🔴 Thinking mode TẮT tường minh. V4 mặc định BẬT (docs DeepSeek: "The
// thinking toggle defaults to enabled"); reasoning token tính giá output và
// làm vỡ timeout 4s cho việc "diễn đạt 4 con số thành 3 câu".
//
// 🔴 System prompt là HẰNG SỐ byte-for-byte (cache prefix DeepSeek rẻ ~98%):
// mọi dữ liệu đi ở user message — buildRequestBody không nội suy gì vào system.
import { env } from "@/env";
import { chatCompletionResponse } from "./schemas";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-v4-flash";

/** Body request — export riêng để test khoá: thinking disabled + system constant. */
export function buildRequestBody(system: string, user: string) {
  return {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
    thinking: { type: "disabled" as const },
    // temperature 0 — cùng input ra output ổn định nhất có thể; tính lặp lại
    // thật sự do cache Dragonfly theo intentId đảm nhiệm.
    temperature: 0,
    max_tokens: 400,
    stream: false as const,
  };
}

/** Gọi chat completion. Throw trên mọi lỗi (HTTP != 2xx, abort, hình lệch) —
 * caller (service explain) đổi mọi throw thành null, không phân loại. */
export async function deepseekComplete(args: {
  system: string;
  user: string;
  signal: AbortSignal;
}): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.DEEPSEEK_API_KEY ?? ""}`,
    },
    body: JSON.stringify(buildRequestBody(args.system, args.user)),
    signal: args.signal,
  });
  if (!res.ok) throw new Error(`DEEPSEEK_HTTP_${res.status}`);
  const parsed = chatCompletionResponse.parse(await res.json());
  return parsed.choices[0]?.message.content ?? "";
}
