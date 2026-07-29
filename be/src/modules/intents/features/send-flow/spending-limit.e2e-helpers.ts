// Helpers cho spending-limit.e2e (LÔ 3) — trích từ onchain.e2e.test.ts, tham
// số hoá để tái dùng: deploy ví bằng chứng từ wasm smart-account ĐÃ upload
// (mặc định bản pin production c1b28d42…), nạp XLM qua SAC transfer.
// CHỈ import từ file e2e (guard RUN_TESTNET_E2E) — không đi vào bundle app.
import {
  Address,
  BASE_FEE,
  hash,
  type Keypair,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { env } from "@/env";
import { externalSignerScVal } from "@/modules/recovery";
import {
  buildInvokeTx,
  feeWallet,
  invokeWithSignedEntries,
  withRpc,
} from "@/services/stellar/stellar.service";
import { transferArgs } from "../../domain/transfer";

/** Verifier ed25519 ĐANG DÙNG (đợt artifact 2026-07-29, docs/DEPLOY.md). */
export const DEFAULT_VERIFIER_ED25519 = "CC7L7IGJ7ZBUQCYUTV6J6KLKMKYKAZIV5FMRISPNIZZW63664TWOVDEE";

/** Wasm smart-account đã upload on-chain — bản pin production (FE/BE env). */
const SMART_ACCOUNT_WASM =
  process.env.E2E_SMART_ACCOUNT_WASM ??
  env.ACCOUNT_WASM_HASH ??
  "c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f";

export async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${kp.publicKey()}: ${res.status}`);
}

/** Deploy ví bằng chứng: constructor(signers=[ownerSigner], policies).
 * `policies` mặc định rỗng; lô policy 2026-07-29 truyền map chở spending-limit
 * để chứng minh ĐƯỜNG CONSTRUCTOR (D1 — ví mới sinh ra đã có trần cứng). */
export async function deployEvidenceWallet(
  ownerSigner: xdr.ScVal,
  txEvidence: Array<{ step: string; hash: string }>,
  policies: xdr.ScVal = xdr.ScVal.scvMap([]),
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
          constructorArgs: [xdr.ScVal.scvVec([ownerSigner]), policies],
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

/** Signer External(verifier-ed25519) cho ví bằng chứng — cùng đường __check_auth
 * với passkey, chạy được không cần authenticator. */
export function evidenceSignerScVal(kp: Keypair, verifier?: string): xdr.ScVal {
  return externalSignerScVal({
    verifier: verifier ?? process.env.E2E_VERIFIER_ED25519 ?? DEFAULT_VERIFIER_ED25519,
    keyBase64: kp.rawPublicKey().toString("base64"),
  });
}

/** Ký entry của ví bằng ed25519 — digest OZ: sha256(payload ++ ruleIds.toXDR()).
 * `ruleIds` là THAM SỐ: người ký CHỌN rule — chính chỗ ca-5 cũ đo được bypass. */
export function signEvidenceWalletEntry(input: {
  entryB64: string;
  validUntil: number;
  ruleIds: number[];
  owner: Keypair;
  verifier?: string;
}): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(input.entryB64, "base64");
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger(input.validUntil);
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(env.STELLAR_NETWORK_PASSPHRASE)),
      nonce: creds.nonce(),
      signatureExpirationLedger: input.validUntil,
      invocation: entry.rootInvocation(),
    }),
  );
  const ruleIds = xdr.ScVal.scvVec(input.ruleIds.map((n) => xdr.ScVal.scvU32(n)));
  const digest = hash(Buffer.concat([hash(preimage.toXDR()), ruleIds.toXDR()]));
  const sig = input.owner.sign(digest);
  creds.signature(
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("context_rule_ids"), val: ruleIds }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signers"),
        val: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: evidenceSignerScVal(input.owner, input.verifier),
            val: xdr.ScVal.scvBytes(sig),
          }),
        ]),
      }),
    ]),
  );
  return entry.toXDR("base64");
}

/** Invoke method của/về ví: build (recording) → ký entry ví theo ruleIds → submit. */
export async function invokeSignedAs(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  ruleIds: number[];
  owner: Keypair;
  verifier?: string;
  step: string;
  txEvidence: Array<{ step: string; hash: string }>;
}): Promise<string> {
  const built = await buildInvokeTx({
    contractId: input.contractId,
    method: input.method,
    args: input.args,
  });
  const signed = built.authEntriesXdr.map((entryB64) =>
    signEvidenceWalletEntry({
      entryB64,
      validUntil: built.latestLedger + 500,
      ruleIds: input.ruleIds,
      owner: input.owner,
      verifier: input.verifier,
    }),
  );
  const res = await invokeWithSignedEntries({
    contractId: input.contractId,
    method: input.method,
    args: input.args,
    authEntries: signed.map((s) => xdr.SorobanAuthorizationEntry.fromXDR(s, "base64")),
  });
  if (res.status !== "SUCCESS") throw new Error(`${input.step}: ${res.status}`);
  input.txEvidence.push({ step: input.step, hash: res.hash });
  return res.hash;
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
