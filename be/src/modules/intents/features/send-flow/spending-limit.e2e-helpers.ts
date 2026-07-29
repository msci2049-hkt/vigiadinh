// Helpers cho spending-limit.e2e (LÔ 3) — trích từ onchain.e2e.test.ts, tham
// số hoá để tái dùng: deploy ví bằng chứng từ wasm smart-account ĐÃ upload
// (mặc định bản pin production 2c19ee49…), nạp XLM qua SAC transfer.
// CHỈ import từ file e2e (guard RUN_TESTNET_E2E) — không đi vào bundle app.
import {
  Address,
  BASE_FEE,
  type Keypair,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { env } from "@/env";
import { feeWallet, withRpc } from "@/services/stellar/stellar.service";
import { transferArgs } from "../../domain/transfer";

/** Wasm smart-account đã upload on-chain — bản pin production (FE/BE env). */
const SMART_ACCOUNT_WASM =
  process.env.E2E_SMART_ACCOUNT_WASM ??
  env.ACCOUNT_WASM_HASH ??
  "2c19ee49d7f25a6a052e2dc16489e5b1b10afc322ff6a8a8483d0e408c796f35";

export async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${kp.publicKey()}: ${res.status}`);
}

/** Deploy ví bằng chứng: constructor(signers=[ownerSigner], policies={}). */
export async function deployEvidenceWallet(
  ownerSigner: xdr.ScVal,
  txEvidence: Array<{ step: string; hash: string }>,
): Promise<string> {
  return withRpc(async (server) => {
    const wallet = feeWallet();
    const source = await server.getAccount(wallet.publicKey());
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createCustomContract({
          address: new Address(wallet.publicKey()),
          wasmHash: Buffer.from(SMART_ACCOUNT_WASM, "hex"),
          salt: Buffer.from(salt),
          constructorArgs: [xdr.ScVal.scvVec([ownerSigner]), xdr.ScVal.scvMap([])],
        }),
      )
      .setTimeout(120)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`deploy sim: ${sim.error}`);
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(wallet);
    const sent = await server.sendTransaction(assembled);
    if (sent.status === "ERROR") throw new Error("deploy rejected");
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== "SUCCESS") throw new Error(`deploy ${final.status}`);
    txEvidence.push({ step: "deploy-evidence-wallet", hash: sent.hash });
    if (!final.returnValue) throw new Error("deploy no addr");
    return scValToNative(final.returnValue) as string;
  });
}

/** Nạp XLM vào ví C…: G funder invoke SAC.transfer(from=G, to=C) — G ký envelope. */
export async function fundContractWallet(
  funder: Keypair,
  walletC: string,
  amount: bigint,
  txEvidence: Array<{ step: string; hash: string }>,
): Promise<void> {
  const sac = env.CONTRACT_ID_SAC_NATIVE;
  if (!sac) throw new Error("CONTRACT_ID_SAC_NATIVE required");
  await withRpc(async (server) => {
    const source = await server.getAccount(funder.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: sac,
          function: "transfer",
          args: transferArgs({ from: funder.publicKey(), to: walletC, amount }),
        }),
      )
      .setTimeout(120)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`fund sim: ${sim.error}`);
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(funder);
    const sent = await server.sendTransaction(assembled);
    if (sent.status === "ERROR") throw new Error("fund rejected");
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== "SUCCESS") throw new Error(`fund ${final.status}`);
    txEvidence.push({ step: "fund-evidence-wallet", hash: sent.hash });
  });
}
