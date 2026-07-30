// Deps THẬT cho đường explain — điểm duy nhất chạm env + Dragonfly + DeepSeek.
// Service nhận deps tiêm được nên test không bao giờ chạm mạng.

import { env } from "@/env";
import { deepseekComplete } from "@/integrations/deepseek/client";
import { rateLimitConnection } from "@/lib/redis";
import type { ExplainDeps } from "./service";

/** Cache đi qua `rateLimitConnection` (fail-fast, enableOfflineQueue=false) —
 * đúng profile cho đường request: Dragonfly chết thì lỗi NGAY, service coi như
 * cache miss. Lưu lượng explain quá nhỏ để đáng một connection thứ tư. */
export function realExplainDeps(): ExplainDeps {
  return {
    // Kill switch: cờ TẮT hay THIẾU key đều là "tắt" — không gọi API lần nào.
    enabled: env.AI_ADVISOR_ENABLED && Boolean(env.DEEPSEEK_API_KEY),
    timeoutMs: 4000,
    cacheGet: (key) => rateLimitConnection.get(key),
    cacheSet: async (key, value, ttlSeconds) => {
      await rateLimitConnection.set(key, value, "EX", ttlSeconds);
    },
    complete: deepseekComplete,
  };
}
