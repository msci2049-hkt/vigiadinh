// GET /api/recovery/chain-truth/:walletId — trạng thái khôi phục ĐỌC THẲNG TỪ CHAIN.
//
// Vì sao tồn tại, và vì sao mirror KHÔNG đủ ở đúng màn này:
//
// Chủ ví chỉ veto được nếu BIẾT có khôi phục đang mở. Biết là nhờ mirror; mirror
// do indexer ghi. Indexer chết trong cửa sổ timelock ⇒ chủ ví không được báo ⇒
// không veto ⇒ khôi phục hoàn tất. Kẻ tấn công không cần phá chữ ký nào cả, chỉ
// cần indexer nghỉ đúng 24 giờ.
//
// Quyền thì mirror không ảnh hưởng (veto vẫn phải do chính ví ký). Nhưng TÍNH
// SỐNG thì có: mất khả năng BIẾT là mất khả năng chặn. Nên màn veto đọc chain,
// và khi chain lệch mirror thì TIN CHAIN.
//
// Endpoint này chỉ đọc (simulation, không tốn phí, không ghi gì).
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { StellarServiceError, simulateRead } from "@/services/stellar/stellar.service";
import * as repo from "../../infra/recovery.repository";
import { type ChainTruth, parseCooldown, parseRecoveryStatus, parseWalletConfig } from "./domain";

const readLimit = rateLimit({
  points: 30,
  duration: 60,
  keyPrefix: "recovery-chain-truth",
  failOpen: false,
});

const addr = (a: string) => nativeToScVal(new Address(a));

async function read(method: string, walletAddress: string): Promise<unknown> {
  if (!env.CONTRACT_ID_RECOVERY) throw new HTTPException(503, { message: "CHAIN_NOT_CONFIGURED" });
  return simulateRead({
    contractId: env.CONTRACT_ID_RECOVERY,
    method,
    args: [addr(walletAddress)],
  });
}

/** Đọc trên CHÍNH VÍ (không phải registry) — cửa sổ bảo vệ sau khôi phục. */
async function readCooldown(walletAddress: string, nowSecs: number) {
  const [lastRotation, registryLink] = await Promise.all([
    simulateRead({ contractId: walletAddress, method: "last_rotation", args: [] }),
    simulateRead({ contractId: walletAddress, method: "get_recovery_registry", args: [] }),
  ]);
  return parseCooldown({ lastRotation, registryLink, nowSecs });
}

export const chainTruthRoute = new Hono().get(
  "/chain-truth/:walletId",
  requireAuth,
  readLimit,
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });

    const wallet = await repo.walletById(c.req.param("walletId"));
    if (!wallet || wallet.userId !== user.id) {
      throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });
    }

    try {
      const nowSecs = Math.floor(Date.now() / 1000);
      const cooldown = await readCooldown(wallet.stellarAddress, nowSecs);

      const registered = await read("is_registered", wallet.stellarAddress);
      if (registered !== true) {
        const truth: ChainTruth = { registered: false, config: null, request: null, cooldown };
        return c.json({ data: truth });
      }

      const config = parseWalletConfig(await read("get_wallet_config", wallet.stellarAddress));

      // `get_recovery_status` panic khi ví CHƯA từng có yêu cầu nào — đó là
      // "không có gì đang mở", không phải lỗi hạ tầng.
      let request = null;
      try {
        const raw = await read("get_recovery_status", wallet.stellarAddress);
        const remaining = await read("timelock_remaining", wallet.stellarAddress);
        request = parseRecoveryStatus(raw, remaining);
      } catch {
        request = null;
      }

      const truth: ChainTruth = { registered: true, config, request, cooldown };
      return c.json({ data: truth });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      if (err instanceof StellarServiceError) {
        // KHÔNG trả "không có gì đang mở" khi chain không đọc được — đó chính là
        // fail-open mà endpoint này sinh ra để tránh. FE hiện cảnh báo mù.
        logger.error({ err: err.message, walletId: wallet.id }, "recovery.chain-truth.unreachable");
        throw new HTTPException(502, { message: "STELLAR_UNAVAILABLE" });
      }
      throw err;
    }
  },
);
