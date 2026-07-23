---
name: add-sse
description: Thêm 1 kênh/sự kiện SSE realtime mới (push server→client) dùng hạ tầng pub/sub Dragonfly có sẵn. Dùng khi user gõ "thêm realtime", "push notification", "SSE", "server-sent events", "live update".
---

# SKILL: Thêm kênh SSE realtime (drop-in)

Hạ tầng đã có sẵn — **KHÔNG dựng lại**:

- `src/lib/realtime.ts` — `publishToUser(userId, event, data)` (gọi từ BẤT KỲ process/worker nào), `addClient`, `closeRealtime`. 2 ioredis connection RIÊNG (pub + sub), KHÔNG đụng bull/rate-limit.
- `src/lib/realtime-core.ts` — lõi fan-out THUẦN (test không cần stack).
- `GET /api/events` (`src/modules/realtime/routes.ts`) — endpoint SSE auth-gated, chỉ kênh `sse:user:{id}` của user đăng nhập.

## Dùng khi nào

- Cần đẩy sự kiện server→client tức thời: thông báo, trạng thái job, badge, live update.
- **KHÔNG** cần bi-directional → đó là WebSocket, không phải SSE.
- **KHÔNG** cần đảm bảo gửi (durable) → SSE pub/sub là **at-most-once** (xem caveat).

## Thêm 1 loại sự kiện mới — chỉ 1 bước

Push ở chỗ nghiệp vụ xảy ra (route handler, BullMQ worker). `event` là tên tuỳ ý, `data` JSON-serializable:

```ts
import { publishToUser } from "@/lib/realtime";

// Trong handler / worker — sau khi commit DB xong:
publishToUser(order.userId, "order.status", { orderId: order.id, status: "paid" });
```

- Gọi được từ **web instance khác** hoặc **BullMQ worker** → vẫn tới đúng client (fan-out cross-process qua Dragonfly).
- `publishToUser` là **fire-and-forget sync** (không `await`), lỗi publish tự log. KHÔNG block request.

## FE nhận

```ts
const es = new EventSource("/api/events", { withCredentials: true }); // gửi cookie session
es.addEventListener("order.status", (e) => {
  const data = JSON.parse(e.data);
  // cập nhật UI
});
es.addEventListener("connected", () => { /* stream mở — refetch state mới nhất */ });
// 'ping' ~20s là heartbeat, bỏ qua.
```

## Caveat BẮT BUỘC nói với FE — at-most-once

- Pub/sub **không buffer**: sự kiện phát ra trong lúc client mất kết nối (cửa sổ reconnect) sẽ **MẤT**.
- `Last-Event-ID` được nhận nhưng **KHÔNG replay** (không có store backlog).
- → FE PHẢI **refetch state** khi nhận `connected` (lúc mở + mỗi lần reconnect) để bù sự kiện rớt.
- SSE chỉ để "hint có thay đổi → đi lấy", KHÔNG phải nguồn sự thật.

## Bảo mật (đã enforce trong endpoint)

- `userId` lấy từ **session** (`c.get("user")`), CẤM lấy từ query/param/body → không stream chéo user.
- Endpoint qua `requireAuth` → no-auth trả **401**.
- Thêm kênh không-phải-per-user (vd room/broadcast)? Mở rộng `realtime-core.ts` (hàm channel mới + check quyền trong handler), giữ nguyên luật: server quyết định kênh, không tin client.

## Lifecycle (đã lo trong /api/events — copy pattern nếu thêm endpoint)

- connect → `addClient` + ensure SUBSCRIBE; `stream.onAbort(cleanup)`.
- disconnect → cleanup gỡ client, UNSUBSCRIBE khi kênh rỗng (chống leak).
- Heartbeat `ping` ~20s giữ sống qua idle/proxy.
- Lỗi push nền → `Sentry.captureException`, KHÔNG `console` (rule `events.md`).

## Proxy/deploy (xem docs/SCALE-RUNBOOK.md)

- Nginx/proxy trước SSE: `proxy_buffering off;` + `proxy_read_timeout` dài (heartbeat lo idle).
- KHÔNG dùng BullMQ cho SSE — pub/sub thuần. (Nếu lỡ dùng queue, tên phải bọc `{}` — guard chặn.)

## Checklist

- [ ] Push qua `publishToUser(userId, event, data)` ở đúng chỗ nghiệp vụ.
- [ ] `event` đặt tên rõ (`<domain>.<action>`), `data` JSON-serializable nhỏ gọn.
- [ ] FE refetch state khi `connected` (bù at-most-once).
- [ ] Không stream chéo user (userId từ session).
- [ ] Curl `GET /api/events` no-auth → 401.
