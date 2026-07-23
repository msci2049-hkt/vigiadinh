// WHY: Unit test fan-out THUẦN — KHÔNG cần Dragonfly. Dùng fake transport
// (loopback in-memory) để chứng minh: đúng user nhận, user khác không nhận,
// cleanup → unsubscribe (không leak). Cross-process thật ở realtime.integration.test.ts.
import { describe, expect, test } from "bun:test";
import {
  createRealtime,
  type RealtimeTransport,
  type SseClient,
  userChannel,
} from "@/lib/realtime-core";

function fakeTransport() {
  const subscribed = new Set<string>();
  const published: Array<[string, string]> = [];
  let handler: ((channel: string, payload: string) => void) | null = null;
  const transport: RealtimeTransport = {
    publish(channel, payload) {
      published.push([channel, payload]);
      // Loopback: chỉ deliver khi kênh đang được subscribe (mô phỏng Dragonfly).
      if (handler && subscribed.has(channel)) handler(channel, payload);
    },
    subscribe(channel) {
      subscribed.add(channel);
    },
    unsubscribe(channel) {
      subscribed.delete(channel);
    },
    onMessage(h) {
      handler = h;
    },
  };
  return { transport, subscribed, published };
}

function recordingClient(id: string) {
  const got: Array<{ event?: string; data: string; id?: string }> = [];
  const client: SseClient = { id, send: (m) => got.push(m) };
  return { client, got };
}

describe("realtime-core fan-out", () => {
  test("publishToUser → chỉ client cùng user nhận", () => {
    const { transport, subscribed } = fakeTransport();
    const rt = createRealtime(transport);
    const a = recordingClient("a");
    const b = recordingClient("b");
    rt.addClient("u1", a.client);
    rt.addClient("u2", b.client);
    expect(subscribed.has(userChannel("u1"))).toBe(true);
    expect(subscribed.has(userChannel("u2"))).toBe(true);

    const id = rt.publishToUser("u1", "order.paid", { amount: 100 });
    expect(id).toHaveLength(26); // ULID event id
    expect(a.got).toHaveLength(1);
    expect(a.got[0]?.event).toBe("order.paid");
    expect(JSON.parse(a.got[0]?.data ?? "{}")).toEqual({ amount: 100 });
    expect(b.got).toHaveLength(0); // user khác KHÔNG nhận
  });

  test("nhiều client cùng user đều nhận", () => {
    const { transport } = fakeTransport();
    const rt = createRealtime(transport);
    const a1 = recordingClient("a1");
    const a2 = recordingClient("a2");
    rt.addClient("u1", a1.client);
    rt.addClient("u1", a2.client);
    expect(rt.clientCount("u1")).toBe(2);
    rt.publishToUser("u1", "ping", {});
    expect(a1.got).toHaveLength(1);
    expect(a2.got).toHaveLength(1);
  });

  test("client ngắt → UNSUBSCRIBE + registry rỗng (không leak)", () => {
    const { transport, subscribed } = fakeTransport();
    const rt = createRealtime(transport);
    const a = recordingClient("a");
    const cleanup = rt.addClient("u1", a.client);
    expect(rt.channelCount()).toBe(1);

    cleanup();
    expect(rt.channelCount()).toBe(0);
    expect(subscribed.has(userChannel("u1"))).toBe(false);

    rt.publishToUser("u1", "ping", {}); // sau khi rỗng → không deliver
    expect(a.got).toHaveLength(0);
  });

  test("cleanup idempotent (onAbort + finally gọi 2 lần)", () => {
    const { transport } = fakeTransport();
    const rt = createRealtime(transport);
    const a = recordingClient("a");
    const cleanup = rt.addClient("u1", a.client);
    cleanup();
    cleanup();
    expect(rt.channelCount()).toBe(0);
  });

  test("còn client thì GIỮ subscribe; client cuối rời mới unsubscribe", () => {
    const { transport, subscribed } = fakeTransport();
    const rt = createRealtime(transport);
    const a1 = recordingClient("a1");
    const a2 = recordingClient("a2");
    const off1 = rt.addClient("u1", a1.client);
    rt.addClient("u1", a2.client);
    off1();
    expect(subscribed.has(userChannel("u1"))).toBe(true); // a2 vẫn còn
    expect(rt.clientCount("u1")).toBe(1);
  });

  test("payload hỏng JSON → bỏ qua, không crash fan-out", () => {
    const { transport } = fakeTransport();
    const rt = createRealtime(transport);
    const a = recordingClient("a");
    rt.addClient("u1", a.client);
    // bơm payload không phải JSON qua transport trực tiếp
    transport.publish(userChannel("u1"), "{not-json");
    expect(a.got).toHaveLength(0);
  });
});
