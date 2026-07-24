// Adapter THẬT cho service SEP-45: nonce store trên Dragonfly + simulator qua rpc.Server.
// Tách khỏi service để test service hermetic (tiêm fake qua Sep45Deps).
import { BASE_FEE, Operation, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";
import { rateLimitConnection } from "@/lib/redis";
import { argsToScVal, decodeEntriesXdr, WEB_AUTH_FN } from "./entries";
import type { ChallengeArgs, ChallengeSimulator, NonceStore, Sep45Config } from "./types";

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
        return sim.error;
      }
      return null;
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
