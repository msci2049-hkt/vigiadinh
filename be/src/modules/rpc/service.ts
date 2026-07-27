// Proxy JSON-RPC 2.0 → Stellar RPC upstream (env.STELLAR_RPC_URL) — mainnet.
// Vì sao tồn tại: FE KHÔNG gọi thẳng provider. Key provider (nếu có) nằm ở
// env BE (STELLAR_RPC_API_KEY) — vào FE bundle là ai cũng đọc được; CSP FE
// nhờ vậy chỉ còn 'self' + API origin.
//
// Bất biến an toàn:
//   1. CHỈ forward method trong RPC_ALLOWED_METHODS — upstream provider có thể
//      phơi thêm method quản trị/billing, không cho mượn đường qua đây.
//   2. Forward ĐÚNG 4 field chuẩn (jsonrpc/id/method/params) — field lạ của
//      client không pass-through lên provider.
//   3. Key + URL upstream KHÔNG BAO GIỜ xuất hiện trong log/error/response:
//      message của fetch error có thể chứa URL (kèm key nếu provider nhúng key
//      trong URL) → catch nuốt message, chỉ log err.name.
import { z } from "zod";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/** Allowlist JSON-RPC method Stellar RPC mà FE thật sự cần (checklist B1). */
export const RPC_ALLOWED_METHODS: ReadonlySet<string> = new Set([
  "getHealth",
  "getNetwork",
  "getVersionInfo",
  "getFeeStats",
  "getLatestLedger",
  "getLedgers",
  "getLedgerEntries",
  "getTransaction",
  "getTransactions",
  "getEvents",
  "simulateTransaction",
  "sendTransaction",
]);

// KHÔNG nhận batch (mảng): stellar-sdk không dùng, và batch làm allowlist +
// rate-limit đếm sai (1 request chở N call).
export const rpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type RpcRequest = z.infer<typeof rpcRequestSchema>;

export type RpcId = string | number | null;

export type JsonRpcErrorBody = {
  jsonrpc: "2.0";
  id: RpcId;
  error: { code: number; message: string };
};

/** Mã lỗi theo JSON-RPC 2.0: -32700 parse, -32600 invalid, -32601 method. */
export function rpcError(id: RpcId, code: number, message: string): JsonRpcErrorBody {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** Lấy id từ body thô (nếu moi được) để error vẫn đối chiếu được phía client. */
export function extractRpcId(raw: unknown): RpcId {
  if (typeof raw === "object" && raw !== null && "id" in raw) {
    const id = (raw as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return null;
}

const UPSTREAM_TIMEOUT_MS = 30_000;

export type UpstreamFetch = typeof fetch;

/**
 * Forward MỘT request đã qua allowlist lên upstream. Luôn trả về một body
 * JSON-RPC (kết quả upstream nguyên văn, hoặc error -32000 khi upstream hỏng)
 * — không throw, route map thẳng ra response 200 theo semantics JSON-RPC.
 */
export async function forwardRpc(
  req: RpcRequest,
  fetchImpl: UpstreamFetch = fetch,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.STELLAR_RPC_API_KEY) {
    headers.Authorization = `Bearer ${env.STELLAR_RPC_API_KEY}`;
  }
  const body = JSON.stringify({
    jsonrpc: "2.0" as const,
    id: req.id,
    method: req.method,
    ...(req.params !== undefined ? { params: req.params } : {}),
  });

  let res: Response;
  try {
    res = await fetchImpl(env.STELLAR_RPC_URL, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    // CHỈ log err.name (TimeoutError/AbortError/TypeError) — message có thể
    // chứa URL upstream, mà URL có thể chở key (cách nạp 1).
    logger.warn({ errName: (err as Error).name }, "rpc.upstream.unreachable");
    return rpcError(req.id, -32000, "RPC_UPSTREAM_UNREACHABLE");
  }

  if (!res.ok) {
    logger.warn({ upstreamStatus: res.status }, "rpc.upstream.error");
    return rpcError(req.id, -32000, `RPC_UPSTREAM_STATUS_${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    return rpcError(req.id, -32000, "RPC_UPSTREAM_BAD_JSON");
  }
}
