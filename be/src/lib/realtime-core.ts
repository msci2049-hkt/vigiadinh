// WHY: Lõi fan-out SSE THUẦN (không ioredis) → unit-test được KHÔNG cần stack.
// Wiring ioredis nằm ở @/lib/realtime. Transport injectable: test dùng fake,
// cross-process dùng ioredis thật. Registry per-process: 1 process giữ map
// userId→clients của riêng nó; cross-process đi qua pub/sub (kênh sse:user:{id}).
import * as Sentry from "@sentry/bun";
import { ulid } from "ulid";

// Lớp vận chuyển pub/sub — chỉ cần 4 thao tác. @/lib/realtime cấp bản ioredis.
export interface RealtimeTransport {
  publish(channel: string, payload: string): void;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
  onMessage(handler: (channel: string, payload: string) => void): void;
}

// 1 client SSE đang mở. `send` do route bọc quanh stream.writeSSE (tự nuốt lỗi
// async qua Sentry — KHÔNG để throw ra fan-out loop).
export interface SseClient {
  id: string;
  send(msg: { event?: string; data: string; id?: string }): void;
}

export interface RealtimeEnvelope {
  event: string;
  data: unknown;
  id: string;
}

export function userChannel(userId: string): string {
  return `sse:user:${userId}`;
}

export interface Realtime {
  publishToUser(userId: string, event: string, data: unknown): string;
  addClient(userId: string, client: SseClient): () => void;
  channelCount(): number;
  clientCount(userId: string): number;
}

export function createRealtime(transport: RealtimeTransport): Realtime {
  // channel → set client của process HIỆN TẠI.
  const channels = new Map<string, Set<SseClient>>();

  transport.onMessage((channel, payload) => {
    const set = channels.get(channel);
    if (!set || set.size === 0) return;
    let envelope: RealtimeEnvelope;
    try {
      envelope = JSON.parse(payload) as RealtimeEnvelope;
    } catch (err) {
      Sentry.captureException(err);
      return;
    }
    const msg = { event: envelope.event, data: JSON.stringify(envelope.data), id: envelope.id };
    for (const client of set) {
      try {
        client.send(msg);
      } catch (err) {
        // Lỗi push nền → Sentry, KHÔNG console (rule events.md / đã enforce).
        Sentry.captureException(err);
      }
    }
  });

  function publishToUser(userId: string, event: string, data: unknown): string {
    const id = ulid();
    const envelope: RealtimeEnvelope = { event, data, id };
    transport.publish(userChannel(userId), JSON.stringify(envelope));
    return id;
  }

  function addClient(userId: string, client: SseClient): () => void {
    const channel = userChannel(userId);
    let set = channels.get(channel);
    if (!set) {
      set = new Set();
      channels.set(channel, set);
      transport.subscribe(channel); // SUBSCRIBE khi có client ĐẦU cho kênh
    }
    set.add(client);

    let removed = false;
    return () => {
      // Idempotent: onAbort + finally cùng gọi cleanup.
      if (removed) return;
      removed = true;
      const current = channels.get(channel);
      if (!current) return;
      current.delete(client);
      if (current.size === 0) {
        channels.delete(channel);
        transport.unsubscribe(channel); // UNSUBSCRIBE khi không còn client nào
      }
    };
  }

  function channelCount(): number {
    return channels.size;
  }

  function clientCount(userId: string): number {
    return channels.get(userChannel(userId))?.size ?? 0;
  }

  return { publishToUser, addClient, channelCount, clientCount };
}
