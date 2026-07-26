// WHY (audit F2): CORS chỉ là hàng rào PHÍA TRÌNH DUYỆT. hono/cors gặp Origin
// lạ chỉ KHÔNG phát Access-Control-Allow-Origin rồi vẫn `await next()` — request
// thật (simple request text/plain, hoặc client tự chế Origin) vẫn CHẠM handler.
// /rpc mount NGOÀI /api/* nên không được csrf({ origin }) gác như các route API.
// Guard này đóng đúng lỗ đó: request mang Origin ∉ TRUSTED_ORIGINS → 403 TRƯỚC
// handler (và trước cả rate-limit của module — kẻ lạ không đốt quota người thật).
//
// Request KHÔNG có header Origin (curl, server-to-server, CLI/tool ví) vẫn qua
// CÓ CHỦ ĐÍCH: Origin là tín hiệu do trình duyệt gắn; thiếu nó thì không phải
// cross-site browser call — chặn sẽ giết client hợp lệ ngoài browser mà không
// thêm an toàn (kẻ tấn công ngoài browser tự bỏ/giả Origin được, lớp bảo vệ
// cho ca đó là rate-limit + allowlist method trong module rpc).
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";

export const originGuard: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("origin");
  if (origin && !env.TRUSTED_ORIGINS.includes(origin)) {
    throw new HTTPException(403, { message: "ORIGIN_NOT_ALLOWED" });
  }
  await next();
};
