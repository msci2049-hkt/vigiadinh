// Tầng Stellar service (PHA 5.1) — điểm DUY NHẤT backend chạm chain.
// Bất biến an toàn (rule security + checklist 5.2 audit):
//   1. Backend KHÔNG BAO GIỜ giữ/ký bằng khoá của NGƯỜI DÙNG — tx của user đến
//      đây đã ký sẵn (passkey qua __check_auth phía FE). Keypair duy nhất ở
//      tầng này là VÍ PHÍ (FEE_WALLET_SECRET): chỉ XLM trả phí, tách custody.
//   2. Fee-bump là phương án A của dự án (OZ Relayer chưa nhận Soroban token —
//      skill passkey §4): ví phí bọc fee-bump quanh tx user đã ký.
//   3. RPC fallback: primary lỗi mạng → thử fallback MỘT lần (không loop).
import {
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Operation,
  rpc,
  scValToNative,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";
import { env } from "@/env";
import { logger } from "@/lib/logger";

export class StellarServiceError extends Error {}

function makeServer(url: string): rpc.Server {
  return new rpc.Server(url, { allowHttp: url.startsWith("http://") });
}

/** Chạy fn trên primary; lỗi (mạng/5xx) → thử fallback nếu có. */
export async function withRpc<T>(fn: (server: rpc.Server) => Promise<T>): Promise<T> {
  const primary = makeServer(env.STELLAR_RPC_URL);
  try {
    return await fn(primary);
  } catch (err) {
    if (!env.STELLAR_RPC_FALLBACK_URL) throw err;
    logger.warn({ err }, "stellar.rpc.primary-failed → fallback");
    return fn(makeServer(env.STELLAR_RPC_FALLBACK_URL));
  }
}

/** Ví phí — throw rõ khi chưa cấu hình (route map 503), KHÔNG silent. */
export function feeWallet(): Keypair {
  if (!env.FEE_WALLET_SECRET) throw new StellarServiceError("FEE_WALLET_NOT_CONFIGURED");
  return Keypair.fromSecret(env.FEE_WALLET_SECRET);
}

export type BuiltInvoke = {
  /** XDR tx CHƯA ký (source = ví phí) — FE/kit ký auth entries rồi trả lại. */
  transactionXdr: string;
  /** Auth entries simulation trả về — FE ký entry của ví mình. */
  authEntriesXdr: string[];
  latestLedger: number;
};

/**
 * Build + simulate MỘT invoke Soroban. Source account = ví phí (sequence +
 * phí thuộc backend); quyền thật nằm ở auth entries mà VÍ NGƯỜI DÙNG phải ký.
 */
export async function buildInvokeTx(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}): Promise<BuiltInvoke> {
  return withRpc(async (server) => {
    const source = await server.getAccount(feeWallet().publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: input.contractId,
          function: input.method,
          args: input.args,
        }),
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new StellarServiceError(`SIMULATION_FAILED:${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    const authEntries =
      sim.result?.auth?.map((entry: xdr.SorobanAuthorizationEntry) => entry.toXDR("base64")) ?? [];
    return {
      transactionXdr: assembled.toXDR(),
      authEntriesXdr: authEntries,
      latestLedger: sim.latestLedger,
    };
  });
}

/**
 * Đọc view fn qua simulation (không submit, không tốn phí) — trả retval native.
 * Source vẫn là ví phí (chỉ mượn sequence để build, không ký gì).
 */
export async function simulateRead(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}): Promise<unknown> {
  return withRpc(async (server) => {
    const source = await server.getAccount(feeWallet().publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: input.contractId,
          function: input.method,
          args: input.args,
        }),
      )
      .setTimeout(60)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new StellarServiceError(`SIMULATION_FAILED:${sim.error}`);
    }
    const retval = sim.result?.retval;
    return retval === undefined ? undefined : scValToNative(retval);
  });
}

/**
 * Invoke với auth entries ĐÃ KÝ (từ FE trả về): build lại op với entries đính kèm
 * → simulate LẠI (chữ ký thật to hơn placeholder — resource fee phải tính theo
 * entry đã ký, RESEARCH-LOG smart-account-kit) → assemble → ví phí ký envelope
 * → submit + poll. entries RỖNG hợp lệ cho method không đòi auth người dùng
 * (vd finalize_recovery — ai crank cũng được sau timelock).
 */
export async function invokeWithSignedEntries(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  authEntries: xdr.SorobanAuthorizationEntry[];
}): Promise<{ hash: string; status: string }> {
  return withRpc(async (server) => {
    const wallet = feeWallet();
    const source = await server.getAccount(wallet.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: input.contractId,
          function: input.method,
          args: input.args,
          auth: input.authEntries,
        }),
      )
      .setTimeout(300)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new StellarServiceError(`SIMULATION_FAILED:${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(wallet);
    const sent = await server.sendTransaction(assembled);
    if (sent.status === "ERROR") {
      throw new StellarServiceError(
        `SUBMIT_REJECTED:${sent.errorResult?.result().switch().name ?? "unknown"}`,
      );
    }
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    return { hash: sent.hash, status: final.status };
  });
}

/**
 * Bọc fee-bump quanh tx ĐÃ KÝ của người dùng — THUẦN (không mạng, test được):
 * ví phí (bumper) chỉ ký LỚP NGOÀI; envelope + chữ ký user giữ NGUYÊN VẸN.
 */
export function buildFeeBumpXdr(innerXdr: string, bumper: Keypair): string {
  const inner = TransactionBuilder.fromXDR(innerXdr, env.STELLAR_NETWORK_PASSPHRASE);
  if (inner instanceof FeeBumpTransaction) {
    throw new StellarServiceError("ALREADY_FEE_BUMPED");
  }
  const outer = TransactionBuilder.buildFeeBumpTransaction(
    bumper,
    // Trần phí lớp ngoài: (số op + 1) × 10 × BASE_FEE — dư cho resource fee Soroban.
    String(Number(BASE_FEE) * 10 * (inner.operations.length + 1)),
    inner as Transaction,
    env.STELLAR_NETWORK_PASSPHRASE,
  );
  outer.sign(bumper);
  return outer.toXDR();
}

/** Fee-bump bằng VÍ PHÍ hệ thống rồi submit + poll. */
export async function submitWithFeeBump(
  innerXdr: string,
): Promise<{ hash: string; status: string }> {
  return submitAndPoll(buildFeeBumpXdr(innerXdr, feeWallet()));
}

/** Submit tx đã ký hoàn chỉnh (user tự trả phí — không fee-bump) + poll. */
export async function submitAndPoll(signedXdr: string): Promise<{ hash: string; status: string }> {
  return withRpc(async (server) => {
    const tx = TransactionBuilder.fromXDR(signedXdr, env.STELLAR_NETWORK_PASSPHRASE);
    const sent = await server.sendTransaction(tx);
    if (sent.status === "ERROR") {
      throw new StellarServiceError(
        `SUBMIT_REJECTED:${sent.errorResult?.result().switch().name ?? "unknown"}`,
      );
    }
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    return { hash: sent.hash, status: final.status };
  });
}
