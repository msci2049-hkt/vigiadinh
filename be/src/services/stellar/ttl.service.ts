// Gia hạn TTL LEDGER ENTRY trực tiếp bằng ExtendFootprintTTLOp — cho những entry
// KHÔNG có hàm contract nào chạm tới (CONTRACT-DUMP.md bảng (b) là bản đồ gap):
//   · instance của origin-verifier + web-auth — 2 contract này KHÔNG có extend_ttl;
//   · WASM CODE entry (mọi contract) — extend_ttl của smart-account/registry chỉ
//     chạm instance + persistent data, code entry dùng chung thì không hàm nào với tới.
// Hết TTL không mất dữ liệu (archive, P23 auto-restore) — đây là tối ưu phí,
// cùng triết lý ttl-keeper.ts. Ví PHÍ trả tiền; op này không đổi được state nào.
import {
  Address,
  BASE_FEE,
  Operation,
  rpc,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { env } from "@/env";
import { assertFeeWithinCap, feeWallet, StellarServiceError, withRpc } from "./stellar.service";

/** Ledger key: contract INSTANCE entry (instance storage + link executable). */
export function contractInstanceKey(contractId: string): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );
}

/** Ledger key: WASM CODE entry theo hash hex 64 ký tự. */
export function contractCodeKey(wasmHashHex: string): xdr.LedgerKey {
  return xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({ hash: Buffer.from(wasmHashHex, "hex") }),
  );
}

/**
 * Đọc wasm hash (hex) của từng contract id qua getLedgerEntries(instance).
 * Nhờ vậy KHÔNG phải khai thêm env hash cho từng contract hạ tầng — id là đủ.
 * Contract chưa deploy → vắng mặt trong map (caller tự bỏ qua). SAC (executable
 * StellarAsset) không có wasm → cũng vắng mặt.
 */
export async function fetchWasmHashHex(contractIds: string[]): Promise<Map<string, string>> {
  if (contractIds.length === 0) return new Map();
  return withRpc(async (server) => {
    const res = await server.getLedgerEntries(...contractIds.map(contractInstanceKey));
    const out = new Map<string, string>();
    for (const entry of res.entries) {
      const data = entry.val.contractData();
      const id = Address.fromScAddress(data.contract()).toString();
      const executable = data.val().instance().executable();
      if (executable.switch() === xdr.ContractExecutableType.contractExecutableWasm()) {
        out.set(id, executable.wasmHash().toString("hex"));
      }
    }
    return out;
  });
}

/**
 * Gia hạn TTL cho một bó ledger key (readOnly footprint) tới `extendTo` ledger.
 * Cùng khung an toàn với invokeWithSignedEntries: simulate → assemble (resource
 * fee thật) → TRẦN PHÍ trước khi ví phí ký (B-SEC-3) → submit + poll.
 */
export async function extendEntriesTtl(input: {
  keys: xdr.LedgerKey[];
  extendTo: number;
  maxFeeStroops?: number;
}): Promise<{ hash: string; status: string }> {
  return withRpc(async (server) => {
    const wallet = feeWallet();
    const source = await server.getAccount(wallet.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.extendFootprintTtl({ extendTo: input.extendTo }))
      .setSorobanData(new SorobanDataBuilder().setReadOnly(input.keys).build())
      .setTimeout(300)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new StellarServiceError(`SIMULATION_FAILED:${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assertFeeWithinCap(assembled.fee, input.maxFeeStroops);
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
