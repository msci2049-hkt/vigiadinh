// WHY: Endpoint SSE auth-gated — chỉ stream kênh sse:user:{id} của CHÍNH user
// đăng nhập. CẤM client chọn userId tùy ý (lấy từ session, không từ query/param).
// Fan-out cross-process qua @/lib/realtime (Dragonfly pub/sub).
import * as Sentry from "@sentry/bun";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { ulid } from "ulid";
import { addClient, type SseClient } from "@/lib/realtime";
import { requireAuth } from "@/middlewares/auth";

// Heartbeat ~20s: giữ kết nối sống qua idle/proxy (proxy_buffering off + read
// timeout dài — xem docs/SCALE-RUNBOOK.md).
const HEARTBEAT_MS = 20_000;

export const realtimeRoutes = new Hono().get("/", requireAuth, (c) => {
  const user = c.get("user");
  // requireAuth đã chặn null; narrow lại cho TS (không dùng non-null assertion).
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  const userId = user.id;
  const lastEventId = c.req.header("Last-Event-ID") ?? null;
  const log = c.get("log");

  return streamSSE(c, async (stream) => {
    const client: SseClient = {
      id: ulid(),
      send: (msg) => {
        // Push nền: lỗi → Sentry, KHÔNG console/throw (rule events.md).
        void stream.writeSSE(msg).catch((err) => Sentry.captureException(err));
      },
    };
    const cleanup = addClient(userId, client);
    stream.onAbort(cleanup); // client ngắt → gỡ client + UNSUBSCRIBE nếu kênh rỗng
    log.info({ userId, clientId: client.id, lastEventId }, "sse.connected");

    // 'connected' đầu — FE biết stream mở. at-most-once: sự kiện rớt trong cửa sổ
    // reconnect KHÔNG replay (pub/sub thuần) → FE refetch bù (xem skill add-sse).
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ ts: new Date().toISOString(), lastEventId }),
      id: ulid(),
    });

    try {
      while (!stream.aborted) {
        await stream.writeSSE({ event: "ping", data: "" });
        await stream.sleep(HEARTBEAT_MS);
      }
    } finally {
      cleanup(); // idempotent với onAbort
      log.info({ userId, clientId: client.id }, "sse.disconnected");
    }
  });
});
