# SKILL: Gọi API ngoài (ofetch + cockatiel)

## Dùng khi nào

- Gọi LLM, payment gateway, OCR, OAuth provider...
- Cần retry tự động + circuit breaker khi provider down.
- Cần parse response chặt chẽ với Zod.
- **KHÔNG** retry mù — phải phân biệt retryable vs permanent.

---

## Thứ tự làm

```
1. Tạo folder src/integrations/<provider>/

2. Tạo 2 file:
   a. schemas.ts  (Zod response schema)
   b. client.ts   (ofetch + cockatiel wrap)

3. Export typed functions (vd: openai.chat.complete).

4. Service consume từ integration — KHÔNG tự fetch.

5. Test 3 case: happy / 429 retry / circuit open.
```

---

## File tạo ở đâu

```
src/integrations/<provider>/
├── schemas.ts   ← Zod schema response
└── client.ts    ← ofetch instance + cockatiel policy
```

---

## Code mẫu — Integration OpenAI

### 1. `src/integrations/openai/schemas.ts`

```ts
/**
 * Zod schema cho response OpenAI.
 * Parse ở boundary integration → không cần `any` lan ra service.
 */
import { z } from "zod";

export const chatCompletionResponse = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.literal("assistant"),
        content: z.string(),
      }),
      finish_reason: z.string().nullable(),
    }),
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

export type ChatCompletionResponse = z.infer<typeof chatCompletionResponse>;
```

### 2. `src/integrations/openai/client.ts`

```ts
/**
 * OpenAI client.
 *
 * Resilience stack:
 *  - ofetch: HTTP client, auto retry với options.retry.
 *  - cockatiel: layer riêng — retry + circuit breaker.
 *
 * Cockatiel wrap order QUAN TRỌNG:
 *  wrap(retryPolicy, circuitBreakerPolicy)
 *  → retry BÊN TRONG, breaker BÊN NGOÀI.
 *  Đảo lại: mỗi retry counted vào breaker → mở quá sớm.
 *
 * 429 Retry-After: ofetch auto retry với delay header `retry-after`.
 */
import { ofetch, FetchError } from "ofetch";
import {
  retry, handleType, ConsecutiveBreaker, circuitBreaker, ExponentialBackoff, wrap,
} from "cockatiel";
import * as Sentry from "@sentry/bun";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { chatCompletionResponse, type ChatCompletionResponse } from "./schemas";

// ------ ofetch instance ------
const $openai = ofetch.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 30_000,
  retry: 2, // retry tại HTTP layer
  retryDelay: 500,
  retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
});

// ------ cockatiel policies ------
const retryPolicy = retry(
  handleType(FetchError, (err) => {
    const status = err.response?.status;
    // Retry: 429 (rate limit), 5xx (transient).
    // KHÔNG retry: 4xx khác (lỗi của mình, retry vô ích).
    if (status && status >= 500) return true;
    if (status === 429) return true;
    if (status === 408 || status === 425) return true;
    return false;
  }),
  { maxAttempts: 3, backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 10_000 }) },
);

const breakerPolicy = circuitBreaker(
  handleType(FetchError),
  {
    halfOpenAfter: 30_000,
    breaker: new ConsecutiveBreaker(5), // 5 lỗi liên tiếp → open 30s
  },
);

breakerPolicy.onBreak(() => {
  logger.error({ provider: "openai" }, "circuit.opened");
  Sentry.captureMessage("circuit.opened: openai", "warning");
});
breakerPolicy.onReset(() => logger.info({ provider: "openai" }, "circuit.reset"));

// wrap(retry, breaker): retry trong, breaker ngoài.
const policy = wrap(retryPolicy, breakerPolicy);

// ------ Typed API ------
export const openai = {
  chat: {
    /**
     * @throws BrokenCircuitError nếu circuit đang mở.
     * @throws FetchError với status code nếu vẫn lỗi sau retry.
     */
    async complete(args: {
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      temperature?: number;
    }): Promise<ChatCompletionResponse> {
      Sentry.addBreadcrumb({
        category: "integration",
        message: `openai.chat.complete model=${args.model}`,
        level: "info",
      });

      const raw = await policy.execute(() =>
        $openai<unknown>("/chat/completions", {
          method: "POST",
          body: {
            model: args.model,
            messages: args.messages,
            temperature: args.temperature ?? 0.7,
          },
        }),
      );

      return chatCompletionResponse.parse(raw);
    },
  },
};
```

### 3. Service tiêu thụ — `src/modules/chat/service.ts`

```ts
/**
 * Service KHÔNG gọi ofetch trực tiếp. Đi qua integration.
 */
import { openai } from "@/integrations/openai/client";

export async function answerQuestion(question: string): Promise<string> {
  const result = await openai.chat.complete({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Trả lời ngắn gọn bằng tiếng Việt." },
      { role: "user", content: question },
    ],
  });
  return result.choices[0].message.content;
}
```

---

## Pattern KHÔNG được dùng

```ts
// ❌ SAI: fetch trực tiếp trong service, không có circuit breaker
const res = await fetch("https://api.openai.com/...");
const data = await res.json(); // any leak

// ❌ SAI: catch error rồi trả null silent → khó debug
try { return await openai.chat.complete(...); }
catch { return null; }

// ❌ SAI: wrap order ngược (breaker bên trong)
const policy = wrap(breakerPolicy, retryPolicy);

// ❌ SAI: retry trên permanent error (4xx khác 408/425/429)
if (status >= 400) return true;
```

---

## Test

```bash
# 1. Happy path
bun --eval "
  import('./src/modules/chat/service').then(async ({ answerQuestion }) => {
    console.log(await answerQuestion('Xin chào'));
  });
"

# 2. Trigger 429: spam 100 lần liên tục → log "retry attempt" + thành công sau backoff.

# 3. Trigger circuit open: dùng wrong API key → 5 lần 401 liên tiếp
# → log "circuit.opened: openai".
# Gọi lần 6 → throw BrokenCircuitError ngay (không hit API).
# Đợi 30s → log "circuit.reset" → request đầu thử thật (half-open).

# 4. Trigger timeout: set OPENAI_BASE_URL = endpoint không tồn tại → timeout 30s, retry 3 lần.
```

---

## Checklist cuối

- [ ] Folder `src/integrations/<provider>/` riêng cho mỗi provider.
- [ ] 2 file: `schemas.ts` + `client.ts`.
- [ ] Zod parse response ở boundary integration.
- [ ] `wrap(retryPolicy, circuitBreakerPolicy)` ĐÚNG thứ tự.
- [ ] `ConsecutiveBreaker(5)` + `halfOpenAfter: 30_000`.
- [ ] `onBreak`/`onReset` log + Sentry breadcrumb.
- [ ] Retry CHỈ 408/425/429/5xx — KHÔNG retry 4xx khác.
- [ ] Service KHÔNG fetch trực tiếp, đi qua integration.
- [ ] Typed function export, không leak `any`.
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| Circuit mở quá sớm | `wrap` ngược thứ tự | `wrap(retry, breaker)` — retry trong, breaker ngoài. |
| Retry vô hạn 4xx | Predicate retry sai | Chỉ retry 408/425/429/5xx. |
| 429 không respect Retry-After | Manual setTimeout cố định | ofetch auto đọc `retry-after`. Đảm bảo trong `retryStatusCodes`. |
| `BrokenCircuitError` không catch | Quên import từ cockatiel | `import { BrokenCircuitError } from "cockatiel"`. |
| Response shape khác → service crash | Không Zod parse | `schema.parse(raw)` ở boundary. |
| Sentry không hiện request | Không add breadcrumb | `Sentry.addBreadcrumb()` trước mỗi call. |
| Timeout không trigger | `timeout` chỉ trong ofetch, undici/node có default lớn hơn | Set explicit `timeout: 30_000`. |
| Multiple service share state circuit | Mỗi service tạo policy riêng | Singleton policy ở `client.ts`. |
| Breaker không mở dù 5xx liên tiếp | `handleType` không match error type | Dùng `handleType(FetchError)`. |
| API key leak trong log | ofetch log full headers | Custom log hook hoặc redact ở pino. |
