// WHY: 1 instance Drizzle dùng toàn hệ thống. `prepare: false` vì postgres-js
// cache prepared statement per-connection — với pool transient, cache miss
// cao, lại tốn memory. Drizzle gen dynamic query → không tận dụng được.
//
// `idle_timeout: 30` (giây): release connection nhàn rỗi để Postgres không
// nuôi quá nhiều idle session (Postgres default `max_connections=100`).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

// Export `client` để graceful shutdown gọi client.end({ timeout }).
// Audit 2026-07-25 (§7): KHÔNG có `statement_timeout` thì MỘT query kẹt giữ
// connection vĩnh viễn. Với `max` 20 mỗi process, chỉ cần vài query như thế là pool
// cạn và app ngừng phục vụ mà KHÔNG có lỗi nào — kiểu hỏng khó lần nhất. Đặt ở tầng
// connection để mọi query đều dính, không phụ thuộc ai đó nhớ set per-query.
//
// 30s: dài hơn mọi query nghiệp vụ thật ở đây (query nặng nhất là list có LIMIT),
// ngắn hơn nhiều so với ngưỡng người dùng bỏ cuộc. `idle_in_transaction_session_
// timeout` chặn ca khác: transaction mở rồi client chết giữa chừng, giữ khoá tới
// khi TCP hết hạn.
//
// CỐ Ý KHÔNG dùng `idleTimeout`/`maxLifetime` kiểu `bun:sql`: driver ở đây là
// postgres-js, không dính bug oven-sh/bun#30646 (timer giết query đang chạy thay vì
// drain). Đừng đổi sang `Bun.SQL` mà không đọc lại issue đó — với ví thì một lệnh
// chuyển tiền chết giữa lúc ghi DB là hỏng thật, không phải một request lỗi.
export const client = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: 30,
  prepare: false,
  connect_timeout: 10,
  connection: {
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
  },
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
