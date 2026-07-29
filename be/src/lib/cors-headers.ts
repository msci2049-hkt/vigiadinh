// Danh sách header client ĐƯỢC PHÉP gửi kèm request cross-origin (`Access-Control-
// Allow-Headers`). Tách khỏi `app.ts` để test khoá được bất biến mà không phải boot
// cả app (app.ts kéo theo DB + Dragonfly + Better Auth).
//
// Luật của danh sách này: THIẾU MỘT header là cả một tính năng chết ở preflight,
// và browser chỉ báo tên header đầu tiên nó vấp — nên mỗi mục phải ghi rõ AI gửi nó.
export const CORS_ALLOW_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Request-Id",
  // Sentry distributed tracing FE→BE.
  "sentry-trace",
  "baggage",
  // @stellar/stellar-sdk gắn CẶP header nhận diện client vào MỌI request RPC
  // (lib/esm/rpc/axios.js) — FE gọi /rpc qua SmartAccountKit nên preflight mang cả
  // hai. Thiếu MỘT trong hai là "Tạo ví" chết ngay cửa.
  "x-client-name",
  "x-client-version",
  // EventSource/SSE gửi `Last-Event-ID` khi NỐI LẠI (chỉ lần reconnect, không có ở
  // lần kết nối đầu) — nên thiếu nó thì SSE trông như chạy tốt cho tới lúc mạng
  // chớp/tab ngủ dậy, rồi im hẳn: preflight đỏ "Request header field last-event-id
  // is not allowed by Access-Control-Allow-Headers". Mọi thứ dựa trên realtime
  // (toast hạn mức, trạng thái người bảo hộ) chết theo mà không báo gì.
  "last-event-id",
] as const;
