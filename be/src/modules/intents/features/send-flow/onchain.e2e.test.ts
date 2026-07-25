// E2E TESTNET THẬT (GATE PHA 6 SEND) — ĐÓNG CHUỖI HAI-NỬA: passkey/khoá External
// → __check_auth → verifier → SAC transfer trong MỘT tx. Gửi XLM TỪ ví hợp đồng
// C… tới người nhận, verify người nhận NHẬN ĐỦ (đọc SAC.balance). Opt-in:
//   RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/onchain.e2e
// Cần: Postgres + FEE_WALLET_SECRET + CONTRACT_ID_SAC_NATIVE + E2E_SMART_ACCOUNT_WASM.
//
// Ví C… ký entry bằng External(verifier-ed25519) — cùng đường __check_auth với
// passkey (chỉ khác verifier), chạy được trên CI không authenticator. Digest =
// sha256(signature_payload ++ scvVec(rule_ids).toXDR()) — công thức OZ do_check_auth.
import { afterAll, describe, expect, it } from "bun:test";
import {
  Address,
  BASE_FEE,
  hash,
  Keypair,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/env";
import { externalSignerScVal } from "@/modules/recovery";
import {
  buildInvokeTx,
  feeWallet,
  invokeWithSignedEntries,
  simulateRead,
  withRpc,
} from "@/services/stellar/stellar.service";
import { pgReachable } from "@/test-support/pg";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { balanceArgs, transferArgs } from "../../domain/transfer";
import { transactionIntents } from "../../infra/intents.schema";
import { confirmSend, prepareSend, type SendGateway, signAndSubmit } from "./service";

const dbUp = await pgReachable();
const enabled =
  dbUp &&
  process.env.RUN_TESTNET_E2E === "1" &&
  Boolean(env.FEE_WALLET_SECRET) &&
  Boolean(env.CONTRACT_ID_SAC_NATIVE) &&
  // Từ closeout B-SEC-3, đường gửi đi qua cổng `is_registered` → không có registry
  // thì e2e SKIP ồn ào, thay vì đỏ với 403 làm người đọc tưởng code hỏng.
  Boolean(env.CONTRACT_ID_RECOVERY);
const testIt = enabled ? it : it.skip;
if (!enabled) {
  console.warn(
    "SKIP send e2e: cần RUN_TESTNET_E2E=1 + Postgres + FEE_WALLET_SECRET + CONTRACT_ID_SAC_NATIVE + CONTRACT_ID_RECOVERY",
  );
}

const SAC = env.CONTRACT_ID_SAC_NATIVE ?? "";
/** Registry — cổng ví phí `is_registered` hỏi ở đây (B-SEC-3 hàng rào 1). */
const REGISTRY = env.CONTRACT_ID_RECOVERY ?? "";
const VERIFIER_ED25519 =
  process.env.E2E_VERIFIER_ED25519 ?? "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const SMART_ACCOUNT_WASM =
  process.env.E2E_SMART_ACCOUNT_WASM ??
  "a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25";

const gateway: SendGateway = {
  build: buildInvokeTx,
  invoke: invokeWithSignedEntries,
  read: simulateRead,
};

const skOwner = Keypair.random(); // External signer của ví C…
const funder = Keypair.random(); // G account nạp XLM vào ví C…
const recipient = Keypair.random(); // người nhận (G)
const OWNER_USER = `e2e-send-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];
const txEvidence: Array<{ step: string; hash: string }> = [];
let walletC = "";

function signerScVal(kp: Keypair): xdr.ScVal {
  return externalSignerScVal({
    verifier: VERIFIER_ED25519,
    keyBase64: kp.rawPublicKey().toString("base64"),
  });
}

async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${kp.publicKey()}: ${res.status}`);
}

async function deploySmartAccount(step: string): Promise<string> {
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
          constructorArgs: [xdr.ScVal.scvVec([signerScVal(skOwner)]), xdr.ScVal.scvMap([])],
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
    txEvidence.push({ step, hash: sent.hash });
    if (!final.returnValue) throw new Error("deploy no addr");
    return scValToNative(final.returnValue) as string;
  });
}

/** Nạp XLM vào ví C…: G funder invoke SAC.transfer(from=G, to=C) — G ký source-account. */
async function fundContractWallet(amount: bigint, step: string): Promise<void> {
  await withRpc(async (server) => {
    const source = await server.getAccount(funder.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: SAC,
          function: "transfer",
          args: transferArgs({ from: funder.publicKey(), to: walletC, amount }),
        }),
      )
      .setTimeout(120)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`fund sim: ${sim.error}`);
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(funder); // source-account auth (G tự ký envelope)
    const sent = await server.sendTransaction(assembled);
    if (sent.status === "ERROR") throw new Error("fund rejected");
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== "SUCCESS") throw new Error(`fund ${final.status}`);
    txEvidence.push({ step, hash: sent.hash });
  });
}

/** Ký entry của SMART ACCOUNT bằng khoá ed25519 (đường __check_auth). */
function signWalletEntry(entryB64: string, validUntil: number): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryB64, "base64");
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger(validUntil);
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(env.STELLAR_NETWORK_PASSPHRASE)),
      nonce: creds.nonce(),
      signatureExpirationLedger: validUntil,
      invocation: entry.rootInvocation(),
    }),
  );
  const ruleIds = xdr.ScVal.scvVec([xdr.ScVal.scvU32(0)]);
  const digest = hash(Buffer.concat([hash(preimage.toXDR()), ruleIds.toXDR()]));
  const sig = skOwner.sign(digest);
  creds.signature(
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("context_rule_ids"), val: ruleIds }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signers"),
        val: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: signerScVal(skOwner), val: xdr.ScVal.scvBytes(sig) }),
        ]),
      }),
    ]),
  );
  return entry.toXDR("base64");
}

async function balanceOf(address: string): Promise<bigint> {
  const raw = await simulateRead({
    contractId: SAC,
    method: "balance",
    args: balanceArgs(address),
  });
  return BigInt(raw as string | number | bigint);
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) await db.delete(wallets).where(eq(wallets.id, id));
  if (txEvidence.length > 0) {
    console.warn("=== TX EVIDENCE (chép vào docs/evidence/TESTNET.md) ===");
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — GỬI TIỀN từ ví hợp đồng (đóng chuỗi hai-nửa)", () => {
  testIt(
    "chuẩn bị: deploy ví C… + nạp XLM (G funder → SAC transfer → C)",
    async () => {
      await friendbot(funder);
      await friendbot(recipient); // recipient tồn tại để đọc balance (0 lúc đầu)
      walletC = await deploySmartAccount("deploy-send-wallet");
      expect(walletC.startsWith("C")).toBe(true);
      await fundContractWallet(50_000_000n, "fund-wallet-c"); // 5 XLM
      expect(await balanceOf(walletC)).toBeGreaterThanOrEqual(50_000_000n);
    },
    300_000,
  );

  testIt(
    "GỬI 1 XLM từ C… tới người nhận: passkey→verifier→transfer 1 tx; người nhận NHẬN ĐỦ",
    async () => {
      if (!walletC) throw new Error("chưa deploy");
      const [w] = await db
        .insert(wallets)
        .values({ userId: OWNER_USER, stellarAddress: walletC })
        .returning({ id: wallets.id });
      if (!w) throw new Error("wallet insert failed");
      cleanupWalletIds.push(w.id);
      // Người nhận ĐÃ BIẾT (policy allow) — seed một settled tới địa chỉ đó.
      await db.insert(transactionIntents).values({
        walletId: w.id,
        clientIntentId: `seed-${crypto.randomUUID().slice(0, 12)}`,
        createdBy: "owner",
        status: "settled",
        operations: [],
        recipient: recipient.publicKey(),
        amount: 1n,
      });

      const amount = 10_000_000n; // 1 XLM
      const before = await balanceOf(recipient.publicKey());

      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER_USER,
        clientIntentId: crypto.randomUUID(),
        recipient: recipient.publicKey(),
        amount,
      });
      expect(review.status).toBe("review");

      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER_USER,
      });
      if (confirmed.status !== "awaiting_signature") {
        throw new Error(`expected awaiting_signature, got ${confirmed.status}`);
      }
      const validUntil = confirmed.latestLedger + 120;
      const signed = confirmed.authEntriesXdr.map((b64) => signWalletEntry(b64, validUntil));

      // Closeout B-SEC-3: `signAndSubmit` giờ gác `is_registered` trên registry
      // TRƯỚC khi ví phí ký. Ví e2e này sinh mới và CHƯA đăng ký, nên e2e phải
      // đăng ký nó trước bước này — xem BLOCKERS "e2e send cần bước register".
      const result = await signAndSubmit(gateway, SAC, REGISTRY, {
        intentId: review.intentId,
        userId: OWNER_USER,
        signedEntriesXdr: signed,
      });
      txEvidence.push({ step: "send-1xlm", hash: result.hash });
      expect(result.status).toBe("settled");

      // Người nhận NHẬN ĐỦ đúng số.
      const after = await balanceOf(recipient.publicKey());
      expect(after - before).toBe(amount);

      // Intent settled trong DB.
      const [row] = await db
        .select({ status: transactionIntents.status })
        .from(transactionIntents)
        .where(eq(transactionIntents.id, review.intentId));
      expect(row?.status).toBe("settled");
    },
    300_000,
  );
});
