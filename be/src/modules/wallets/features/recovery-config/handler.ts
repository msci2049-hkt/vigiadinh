// PATCH /api/wallets/:id/recovery-config — ngưỡng + thời gian chờ (wizard mức B).
//
// Chỉ sửa được TRƯỚC khi ví đăng ký lên registry. Sau đó hai giá trị này đóng
// băng trên chain (registry v2 không có `set_threshold`), và ghi vào DB một con
// số chain không công nhận là dối người dùng ở đúng chỗ nguy hiểm nhất.
//
// Câu hỏi "đã đăng ký chưa" hỏi THẲNG CHAIN (`is_registered`), không hỏi mirror:
// mirror do indexer ghi, indexer chậm/chết là mở cửa ghi đè cấu hình đã chốt.

import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { assertWalletScope } from "@/lib/wallet-scope";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { StellarServiceError, simulateRead } from "@/services/stellar/stellar.service";
import * as repo from "../../infra/wallets.repository";
import { validateRecoveryConfig } from "./domain";
import { recoveryConfigBody } from "./dto";

const writeLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "wallet-recovery-config",
  failOpen: false,
});

/**
 * Ví đã đăng ký trên registry chưa — đọc TỪ CHAIN.
 * Chưa cấu hình registry → coi như chưa đăng ký (dev/testnet chưa nối chain).
 * Lỗi MẠNG thì KHÔNG được đoán "chưa đăng ký" — đó là fail-open ở cửa ghi.
 */
async function isRegisteredOnchain(walletAddress: string): Promise<boolean> {
  if (!env.CONTRACT_ID_RECOVERY) return false;
  try {
    const result = await simulateRead({
      contractId: env.CONTRACT_ID_RECOVERY,
      method: "is_registered",
      args: [nativeToScVal(new Address(walletAddress))],
    });
    return result === true;
  } catch (err) {
    if (err instanceof StellarServiceError) {
      logger.error({ err: err.message, walletAddress }, "wallet.recovery-config.chain-unreachable");
      throw new HTTPException(502, { message: "STELLAR_UNAVAILABLE" });
    }
    throw err;
  }
}

export const recoveryConfigRoute = new Hono().patch(
  "/:id/recovery-config",
  requireAuth,
  writeLimit,
  zv("json", recoveryConfigBody),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    // Scope session passkey: đổi ngưỡng khôi phục của ví B bằng chìa ví A bị chối.
    assertWalletScope(c.get("session"), c.req.param("id"));
    const wallet = await repo.findByIdForUser(c.req.param("id"), user.id);
    if (!wallet) throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });

    const body = c.req.valid("json");
    const threshold = body.threshold ?? wallet.threshold;
    const timelockSecs = body.timelock_secs ?? wallet.timelockSecs;

    const error = validateRecoveryConfig({
      threshold,
      timelockSecs,
      registeredOnchain: await isRegisteredOnchain(wallet.stellarAddress),
    });
    if (error) {
      throw new HTTPException(error === "ALREADY_REGISTERED_ONCHAIN" ? 409 : 400, {
        message: error,
      });
    }

    const updated = await repo.updateRecoveryConfig(wallet.id, { threshold, timelockSecs });
    return c.json({ data: updated });
  },
);
