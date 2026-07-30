// Zod cho response DeepSeek (wire format OpenAI-compatible) — parse ở boundary
// integration, service không bao giờ thấy `any`. Response lệch hình = throw =
// đường explain trả null (fail-safe), không crash.
import { z } from "zod";

export const chatCompletionResponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
});

export type ChatCompletionResponse = z.infer<typeof chatCompletionResponse>;
