// Route POST /rpc — proxy JSON-RPC sang Stellar RPC upstream (mount ở app.ts,
// NGOÀI /api/* nên không qua csrf — JSON-only; CORS toàn cục app.use("*") vẫn phủ).
// PUBLIC có chủ đích: kit ví (smart-account-kit) cần RPC từ màn tạo ví /passkey,
// TRƯỚC khi có session — cùng lý do với /api/sep45. Gác bằng rate-limit
// failOpen=false + allowlist method + cap body (checklist B1/B2).
//
// KHÔNG dùng zv(): client ở đây là thư viện JSON-RPC — nó cần shape lỗi
// {jsonrpc, id, error}, không phải envelope API của app. Zod vẫn validate
// (rpcRequestSchema) nhưng map lỗi theo JSON-RPC.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { rateLimit } from "@/middlewares/rate-limit";
import {
  extractRpcId,
  forwardRpc,
  RPC_ALLOWED_METHODS,
  rpcError,
  rpcRequestSchema,
} from "./service";

/**
 * 120 điểm / 60s theo key (user id hoặc IP — middlewares/rate-limit).
 * Vì sao rộng hơn sep45 (10/60): một lượt gửi tiền thật = simulate + fees +
 * send + poll getTransaction ~2s/lần → dồn dập vài chục call/phút là bình
 * thường; 2 call/giây trung bình vẫn chặn được kẻ quét. failOpen=false như
 * mọi cửa public chưa auth (sep45/routes.ts).
 */
export const RPC_RATE_LIMIT = { points: 120, duration: 60 } as const;

/** Cap body 512KB (checklist B1) — tx XDR + simulate lớn nhất vẫn dưới xa. */
export const RPC_MAX_BODY_BYTES = 512 * 1024;

export const rpcRoutes = new Hono().post(
  "/",
  rateLimit({
    points: RPC_RATE_LIMIT.points,
    duration: RPC_RATE_LIMIT.duration,
    keyPrefix: "rpc-proxy",
    failOpen: false,
  }),
  bodyLimit({
    maxSize: RPC_MAX_BODY_BYTES,
    // 413 là hợp lý duy nhất ngoài 200: request chưa đọc được thì chưa có id.
    onError: (c) => c.json(rpcError(null, -32600, "BODY_TOO_LARGE"), 413),
  }),
  async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, "PARSE_ERROR"));
    }
    if (Array.isArray(raw)) {
      // Batch: từ chối rõ (xem service.ts) — không lặng lẽ lấy phần tử đầu.
      return c.json(rpcError(null, -32600, "BATCH_UNSUPPORTED"));
    }
    const parsed = rpcRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(rpcError(extractRpcId(raw), -32600, "INVALID_REQUEST"));
    }
    if (!RPC_ALLOWED_METHODS.has(parsed.data.method)) {
      // KHÔNG forward — provider có thể phơi method ngoài chuẩn Stellar RPC.
      return c.json(rpcError(parsed.data.id, -32601, "METHOD_NOT_ALLOWED"));
    }
    const body = await forwardRpc(parsed.data);
    // Luôn 200 theo semantics JSON-RPC — lỗi nằm trong body.error.
    return c.json(body as Record<string, unknown>);
  },
);
