// WHY: Acceptance CROSS-PROCESS — chứng minh fan-out qua Dragonfly thật:
// client nối "process A", publish từ "process B" → A nhận. CẦN STACK SỐNG.
// Bật: RUN_REALTIME_IT=1 (+ REDIS_URL trỏ Dragonfly). KHÔNG bật → SKIP rõ ràng,
// KHÔNG giả vờ pass (lệnh: RUN_REALTIME_IT=1 bun test src/lib/realtime.integration.test.ts).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import IORedis from "ioredis";
import { createRealtime, type RealtimeTransport, type SseClient } from "@/lib/realtime-core";

const RUN = process.env.RUN_REALTIME_IT === "1";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:3699";

function ioTransport(pub: IORedis, sub: IORedis): RealtimeTransport {
  return {
    publish: (ch, p) => void pub.publish(ch, p),
    subscribe: (ch) => void sub.subscribe(ch),
    unsubscribe: (ch) => void sub.unsubscribe(ch),
    onMessage: (h) => void sub.on("message", h),
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

(RUN ? describe : describe.skip)("realtime cross-process (CẦN Dragonfly sống)", () => {
  let pubA: IORedis;
  let subA: IORedis;
  let pubB: IORedis;
  let subB: IORedis;

  beforeAll(() => {
    // "process A" và "process B" = 2 cặp connection độc lập tới cùng Dragonfly.
    pubA = new IORedis(REDIS_URL);
    subA = new IORedis(REDIS_URL);
    pubB = new IORedis(REDIS_URL);
    subB = new IORedis(REDIS_URL);
  });

  afterAll(async () => {
    await Promise.allSettled([pubA.quit(), subA.quit(), pubB.quit(), subB.quit()]);
  });

  test("publish từ process B → client ở process A nhận đủ", async () => {
    const rtA = createRealtime(ioTransport(pubA, subA));
    const rtB = createRealtime(ioTransport(pubB, subB));

    const got: string[] = [];
    const client: SseClient = { id: "a", send: (m) => got.push(m.data) };
    rtA.addClient("u1", client);
    await wait(150); // chờ SUBSCRIBE propagate

    rtB.publishToUser("u1", "cross", { ok: true });
    await wait(200);

    expect(got.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(got[0] ?? "{}")).toEqual({ ok: true });
  });
});
