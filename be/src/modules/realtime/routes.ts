// WHY: Endpoint SSE auth-gated — chỉ stream kênh sse:user:{id} của CHÍNH user
// đăng nhập. CẤM client chọn userId tùy ý (lấy từ session, không từ query/param).
// Fan-out cross-process qua @/lib/realtime (Dragonfly pub/sub).
import * as Sentry from "@sentry/bun";
import { Hono } from "hono";
import { getBunServer } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { ulid } from "ulid";
import { addClient, type SseClient } from "@/lib/realtime";
import { requireAuth } from "@/middlewares/auth";

// Heartbeat ~20s: vẫn BẮT BUỘC dù đã tắt idleTimeout của Bun bên dưới — nó giữ
// kết nối sống qua các tầng KHÁC (nginx proxy_read_timeout: mặc định 60s, vhost
// mẫu 3600s — xem deploy/nginx.vhost.example) và giúp phát hiện client chết.
// Hai lớp là hai việc: timeout(req, 0) xử lý Bun, heartbeat xử lý proxy.
const HEARTBEAT_MS = 20_000;

/** Hình tối thiểu của Bun Server ta cần — bun-types đổi chữ ký generic của
 * `Server` giữa các bản (`Server<WebSocketData>`), type cấu trúc thì bền. */
type BunServerLike = { timeout: (request: Request, seconds: number) => void };

export const realtimeRoutes = new Hono().get("/", requireAuth, (c) => {
  const user = c.get("user");
  // requireAuth đã chặn null; narrow lại cho TS (không dùng non-null assertion).
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  const userId = user.id;
  const lastEventId = c.req.header("Last-Event-ID") ?? null;
  const log = c.get("log");

  // Bun.serve đóng MỌI kết nối im lặng sau idleTimeout mặc định 10 GIÂY, và
  // stream SSE không ghi gì giữa hai heartbeat BỊ TÍNH là idle (sự cố 30/07:
  // mọi kết nối /api/events chết ở giây ~10 — TRƯỚC ping thứ hai ở giây 20 —
  // FE nối lại ngay → chu kỳ đứt/nối 12s bất tận, realtime tê liệt). Tắt
  // timeout CHO RIÊNG request này ("0 means no timeout" — bun-types serve.d.ts)
  // thay vì nâng idleTimeout toàn cục: trần toàn cục chỉ ≤255s và mọi route
  // thường vẫn cần lớp bảo vệ 10s đó. ĐỪNG GỠ dòng này trừ khi heartbeat đã
  // ngắn hơn idleTimeout. `getBunServer` (helper chính chủ của Hono) trả
  // undefined khi không chạy dưới Bun.serve thật (app.request trong test).
  getBunServer<BunServerLike>(c)?.timeout(c.req.raw, 0);

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
