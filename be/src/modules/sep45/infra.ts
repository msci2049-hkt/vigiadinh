// Adapter THẬT cho service SEP-45: nonce store trên Dragonfly + simulator qua rpc.Server.
// Tách khỏi service để test service hermetic (tiêm fake qua Sep45Deps).
import { BASE_FEE, Operation, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logger";
import { rateLimitConnection } from "@/lib/redis";
// Ngoại lệ TẦNG SCHEMA có chủ đích, cùng tiền lệ recovery.repository: đọc MỘT cột
// của bảng wallets. Không đi qua facade module wallets vì đây là truy vấn hạ tầng
// một dòng, không phải nghiệp vụ ví — và facade đó không phơi jwt_version.
import { wallets } from "../wallets/infra/wallets.schema";
import { argsToScVal, decodeEntriesXdr, WEB_AUTH_FN } from "./entries";
import type { ChallengeArgs, ChallengeSimulator, NonceStore, Sep45Config } from "./types";

/**
 * Số hiệu phiên ví hiện tại (closeout §4) — nguồn cho `ver` lúc phát JWT và cho
 * cửa verify lúc nhận. `null` = không có ví này trong DB → không phát/không nhận.
 */
export async function walletJwtVersion(walletAddress: string): Promise<number | null> {
  const [row] = await db
    .select({ v: wallets.jwtVersion })
    .from(wallets)
    .where(eq(wallets.stellarAddress, walletAddress))
    .limit(1);
  return row?.v ?? null;
}

// Dùng rateLimitConnection (enableOfflineQueue=false, fail-fast): nonce auth cùng
// profile với rate-limit — Dragonfly chết thì trả lỗi ngay, không treo request.
export const redisNonceStore: NonceStore = {
  async put(nonce, payload, ttlSeconds) {
    const result = await rateLimitConnection.set(
      `sep45:nonce:${nonce}`,
      payload,
      "EX",
      ttlSeconds,
      "NX",
    );
    return result === "OK";
  },
  async consume(nonce) {
    return rateLimitConnection.getdel(`sep45:nonce:${nonce}`);
  },
};

/** Simulate tx web_auth_verify với entries client đã ký — bước verify chữ ký của spec
 * (server signature + __check_auth của ví contract đều chạy trong simulation). */
export function rpcSimulator(config: Sep45Config): ChallengeSimulator {
  return {
    async simulate(entriesXdrBase64: string, args: ChallengeArgs) {
      const server = new rpc.Server(config.rpcUrl, {
        allowHttp: config.rpcUrl.startsWith("http://"),
      });
      const source = await server.getAccount(config.serverAccount);
      const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: config.webAuthContractId,
            function: WEB_AUTH_FN,
            args: [argsToScVal(args)],
            auth: decodeEntriesXdr(entriesXdrBase64),
          }),
        )
        .setTimeout(60)
        .build();
      const sim = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) {
        logger.warn({ account: args.account, error: sim.error }, "sep45.simulation.failed");
        return { ok: false, error: sim.error };
      }
      // Footprint do HOST tính, không do ta suy luận — đây là input cho cổng cơ chế
      // `assertNonceOnlyFootprint`. Không có transactionData thì KHÔNG đoán "chắc
      // rỗng": không đọc được footprint nghĩa là không kiểm được, phải chối.
      const data = sim.transactionData?.build();
      if (!data) {
        logger.warn({ account: args.account }, "sep45.simulation.no-footprint");
        return { ok: false, error: "NO_TRANSACTION_DATA" };
      }
      return { ok: true, readWrite: data.resources().footprint().readWrite() };
    },
  };
}

export function rpcLatestLedger(config: Sep45Config): () => Promise<number> {
  return async () => {
    const server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
    const { sequence } = await server.getLatestLedger();
    return sequence;
  };
}
