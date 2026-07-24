// E2E TESTNET THẬT (GATE AUDIT P0 + PHA 5) — khôi phục VÍ CONTRACT đúng nghĩa:
// wallet = SMART ACCOUNT (C…), finalize xoay khoá BÊN TRONG account, verify signer
// list đọc TỪ SMART ACCOUNT (không phải registry), khoá mới ký được / khoá cũ bị
// chối / cooldown chặn xoay-rồi-rút-ngay. Chạm mạng thật + tốn phí → opt-in:
//   RUN_TESTNET_E2E=1 bun test onchain.e2e
// Cần: Postgres + FEE_WALLET_SECRET + CONTRACT_ID_RECOVERY (registry v2) trong .env.
//
// Ký smart-account ở đây bằng External(verifier-ed25519, pubkey) — cùng đường
// __check_auth với passkey (chỉ khác verifier), chạy được trên CI không authenticator.
// Digest ký = sha256(signature_payload ++ scvVec(context_rule_ids).toXDR()) — đúng
// công thức OZ do_check_auth (RESEARCH-LOG smart-account-kit P27).
import { afterAll, describe, expect, it } from "bun:test";
import {
  Address,
  authorizeEntry,
  BASE_FEE,
  hash,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/env";
import {
  buildInvokeTx,
  feeWallet,
  invokeWithSignedEntries,
  StellarServiceError,
  simulateRead,
  withRpc,
} from "@/services/stellar/stellar.service";
import { pgReachable } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { contractErrorCode, externalSignerScVal, finalizeArgs } from "../../domain/onchain";
import {
  buildRecoveryAction,
  finalizeRecovery,
  type OnchainGateway,
  submitRecoveryAction,
} from "./service";

const dbUp = await pgReachable();
const enabled =
  dbUp &&
  process.env.RUN_TESTNET_E2E === "1" &&
  Boolean(env.FEE_WALLET_SECRET) &&
  Boolean(env.CONTRACT_ID_RECOVERY);
const testIt = enabled ? it : it.skip;
if (!enabled) {
  console.warn(
    "SKIP e2e testnet: cần RUN_TESTNET_E2E=1 + Postgres + FEE_WALLET_SECRET + CONTRACT_ID_RECOVERY",
  );
}

const REGISTRY = env.CONTRACT_ID_RECOVERY ?? "";
// Hạ tầng e2e cố định trên testnet (RESEARCH-LOG 2026-07-24 audit P0) — knob riêng
// của spec này, không phải config app → đọc process.env trực tiếp, không qua env schema.
const VERIFIER_ED25519 =
  process.env.E2E_VERIFIER_ED25519 ?? "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const SMART_ACCOUNT_WASM =
  process.env.E2E_SMART_ACCOUNT_WASM ??
  "a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25";

const TIMELOCK_SECS = 6;
const COOLDOWN_SECS = 20;

const gateway: OnchainGateway = {
  build: buildInvokeTx,
  invoke: invokeWithSignedEntries,
  read: simulateRead,
};

// Diễn viên: khoá CŨ/MỚI của ví contract (ed25519 raw — External signer),
// 2 guardian classic (G…) + ví 2 cho luồng veto.
const skOld = Keypair.random();
const skNew = Keypair.random();
const skW2 = Keypair.random();
const g1 = Keypair.random();
const g2 = Keypair.random();

const OWNER1_USER = `e2e-o1-${crypto.randomUUID().slice(0, 8)}`;
const OWNER2_USER = `e2e-o2-${crypto.randomUUID().slice(0, 8)}`;
const G1_USER = `e2e-g1-${crypto.randomUUID().slice(0, 8)}`;
const G2_USER = `e2e-g2-${crypto.randomUUID().slice(0, 8)}`;

const cleanupWalletIds: string[] = [];
/** Bằng chứng nộp hồ sơ: mọi tx hash in ra cuối run (docs/evidence/TESTNET.md). */
const txEvidence: Array<{ step: string; hash: string }> = [];
/** Địa chỉ 2 smart account, set ở bước deploy. */
let account1 = "";
let account2 = "";

function rawPubBase64(kp: Keypair): string {
  return kp.rawPublicKey().toString("base64");
}

function signerScVal(kp: Keypair): xdr.ScVal {
  return externalSignerScVal({ verifier: VERIFIER_ED25519, keyBase64: rawPubBase64(kp) });
}

async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`friendbot ${kp.publicKey()}: HTTP ${res.status}`);
  }
}

/**
 * Deploy MỘT smart account instance (wasm hash đã upload) với đúng 1 External
 * signer ed25519 — vai "FE tạo ví" (kit làm việc này ở production; e2e tự dựng
 * để không phụ thuộc browser). Deployer = ví phí (source account tự authorize).
 */
async function deploySmartAccount(ownerKp: Keypair, step: string): Promise<string> {
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
          constructorArgs: [xdr.ScVal.scvVec([signerScVal(ownerKp)]), xdr.ScVal.scvMap([])],
        }),
      )
      .setTimeout(120)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`deploy sim failed: ${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(wallet);
    const sent = await server.sendTransaction(assembled);
    if (sent.status === "ERROR") throw new Error("deploy submit rejected");
    const final = await server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== "SUCCESS") throw new Error(`deploy tx ${final.status}`);
    txEvidence.push({ step, hash: sent.hash });
    const retval = final.returnValue;
    if (!retval) throw new Error("deploy không trả địa chỉ");
    return scValToNative(retval) as string;
  });
}

/**
 * Ký MỘT auth entry của SMART ACCOUNT bằng khoá ed25519 (External signer):
 * dựng lại signature_payload từ HashIdPreimage của entry, cộng rule_ids theo
 * công thức OZ, ký digest, nhét AuthPayload {signers, context_rule_ids} vào
 * credentials.signature. Rule 0 = owner-rule (constructor).
 */
function signSmartAccountEntry(entryB64: string, validUntilLedger: number, kp: Keypair): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryB64, "base64");
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger(validUntilLedger);

  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(env.STELLAR_NETWORK_PASSPHRASE)),
      nonce: creds.nonce(),
      signatureExpirationLedger: validUntilLedger,
      invocation: entry.rootInvocation(),
    }),
  );
  const signaturePayload = hash(preimage.toXDR());
  const ruleIds = xdr.ScVal.scvVec([xdr.ScVal.scvU32(0)]);
  const digest = hash(Buffer.concat([signaturePayload, ruleIds.toXDR()]));
  const sig = kp.sign(digest);

  // AuthPayload struct → ScMap key Symbol theo thứ tự alphabet (contracttype).
  creds.signature(
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("context_rule_ids"), val: ruleIds }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signers"),
        val: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: signerScVal(kp), val: xdr.ScVal.scvBytes(sig) }),
        ]),
      }),
    ]),
  );
  return entry.toXDR("base64");
}

/** Gọi thẳng một method của SMART ACCOUNT với entry ký bằng khoá đưa vào. */
async function invokeAccountAs(input: {
  account: string;
  method: string;
  args: xdr.ScVal[];
  kp: Keypair;
  step?: string;
}): Promise<{ hash: string; status: string }> {
  const built = await buildInvokeTx({
    contractId: input.account,
    method: input.method,
    args: input.args,
  });
  const signed = built.authEntriesXdr.map((b64) =>
    signSmartAccountEntry(b64, built.latestLedger + 120, input.kp),
  );
  const result = await invokeWithSignedEntries({
    contractId: input.account,
    method: input.method,
    args: input.args,
    authEntries: signed.map((s) => xdr.SorobanAuthorizationEntry.fromXDR(s, "base64")),
  });
  if (input.step) txEvidence.push({ step: input.step, hash: result.hash });
  return result;
}

async function seedWalletRow(input: {
  ownerUser: string;
  address: string;
  timelockSecs: number;
}): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: input.ownerUser,
      stellarAddress: input.address,
      threshold: 2,
      timelockSecs: input.timelockSecs,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values([
    { walletId: w.id, userId: G1_USER, onchainKey: g1.publicKey(), status: "active" },
    { walletId: w.id, userId: G2_USER, onchainKey: g2.publicKey(), status: "active" },
  ]);
  return w.id;
}

/**
 * Build → ký → submit MỘT action recovery qua route service (vai FE).
 * Entry của smart account (C…) ký kiểu __check_auth; entry classic (G…) ký
 * authorizeEntry như cũ — phân theo địa chỉ credentials.
 */
async function buildSignSubmit(input: {
  action: "register" | "initiate" | "approve" | "veto";
  walletId: string;
  userId: string;
  accountSigner?: Keypair; // khoá External của smart account
  classicSigners?: Keypair[]; // guardian G…
  newSigner?: Keypair; // chỉ initiate
  step: string;
}): Promise<{ hash: string; status: string }> {
  const built = await buildRecoveryAction(gateway, REGISTRY, {
    action: input.action,
    walletId: input.walletId,
    userId: input.userId,
    ...(input.newSigner
      ? { newSignerVerifier: VERIFIER_ED25519, newSignerKey: rawPubBase64(input.newSigner) }
      : {}),
  });
  expect(built.authEntriesXdr.length).toBeGreaterThan(0);
  const validUntil = built.latestLedger + 120;
  const byAddress = new Map((input.classicSigners ?? []).map((kp) => [kp.publicKey(), kp]));
  const signed: string[] = [];
  for (const b64 of built.authEntriesXdr) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64");
    const address = Address.fromScAddress(entry.credentials().address().address()).toString();
    if (address.startsWith("C")) {
      if (!input.accountSigner) throw new Error(`thiếu khoá smart account cho entry ${address}`);
      signed.push(signSmartAccountEntry(b64, validUntil, input.accountSigner));
    } else {
      const kp = byAddress.get(address);
      if (!kp) throw new Error(`không có keypair cho entry ${address}`);
      const done = await authorizeEntry(entry, kp, validUntil, env.STELLAR_NETWORK_PASSPHRASE);
      signed.push(done.toXDR("base64"));
    }
  }
  const result = await submitRecoveryAction(gateway, REGISTRY, {
    walletId: input.walletId,
    userId: input.userId,
    signedEntriesXdr: signed,
  });
  expect(result.status).toBe("SUCCESS");
  txEvidence.push({ step: input.step, hash: result.hash });
  return result;
}

async function readStatus(address: string): Promise<Record<string, unknown>> {
  return (await simulateRead({
    contractId: REGISTRY,
    method: "get_recovery_status",
    args: finalizeArgs({ wallet: address }),
  })) as Record<string, unknown>;
}

/** Signer list của owner-rule đọc TỪ SMART ACCOUNT — ground truth khôi phục. */
async function accountSigners(account: string): Promise<Array<[string, string, Buffer]>> {
  const rule = (await simulateRead({
    contractId: account,
    method: "get_context_rule",
    args: [xdr.ScVal.scvU32(0)],
  })) as { signers: Array<[string, string, Buffer]> };
  return rule.signers;
}

function hasKey(signers: Array<[string, string, Buffer]>, kp: Keypair): boolean {
  return signers.some(
    ([kind, , key]) => kind === "External" && Buffer.from(key).equals(kp.rawPublicKey()),
  );
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id));
  }
  if (txEvidence.length > 0) {
    console.warn("=== TX EVIDENCE (chép vào docs/evidence/TESTNET.md) ===");
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — khôi phục ví CONTRACT (audit P0)", () => {
  testIt(
    "chuẩn bị: fund guardian + deploy 2 smart account (khoá cũ) + trỏ registry",
    async () => {
      await Promise.all([friendbot(g1), friendbot(g2)]);
      account1 = await deploySmartAccount(skOld, "deploy-account1");
      account2 = await deploySmartAccount(skW2, "deploy-account2");
      expect(account1.startsWith("C")).toBe(true);
      expect(account2.startsWith("C")).toBe(true);

      // set_recovery_registry — KHOÁ CŨ ký qua __check_auth thật (crypto thật).
      const setArgs = (cooldown: number) => [
        new Address(REGISTRY).toScVal(),
        nativeToScVal(cooldown, { type: "u64" }),
      ];
      const r1 = await invokeAccountAs({
        account: account1,
        method: "set_recovery_registry",
        args: setArgs(COOLDOWN_SECS),
        kp: skOld,
        step: "set-registry-a1",
      });
      expect(r1.status).toBe("SUCCESS");
      const r2 = await invokeAccountAs({
        account: account2,
        method: "set_recovery_registry",
        args: setArgs(COOLDOWN_SECS),
        kp: skW2,
        step: "set-registry-a2",
      });
      expect(r2.status).toBe("SUCCESS");
    },
    300_000,
  );

  testIt(
    "luồng 1 — THIẾT LẬP: register_wallet, VÍ CONTRACT tự ký entry qua __check_auth",
    async () => {
      const walletId = await seedWalletRow({
        ownerUser: OWNER1_USER,
        address: account1,
        timelockSecs: TIMELOCK_SECS,
      });
      await buildSignSubmit({
        action: "register",
        walletId,
        userId: OWNER1_USER,
        accountSigner: skOld,
        step: "register-a1",
      });
      const registered = await simulateRead({
        contractId: REGISTRY,
        method: "is_registered",
        args: finalizeArgs({ wallet: account1 }),
      });
      expect(registered).toBe(true);
    },
    180_000,
  );

  testIt(
    "luồng 2 — KHÔI PHỤC THẬT: initiate(khoá mới) → đủ phiếu → timelock → finalize XOAY KHOÁ trong account → cooldown chặn → khoá mới ký được, khoá cũ chết",
    async () => {
      const walletId = cleanupWalletIds[0];
      if (!walletId) throw new Error("luồng 1 chưa chạy");

      // TRƯỚC khôi phục: account chỉ có khoá CŨ.
      let signers = await accountSigners(account1);
      expect(hasKey(signers, skOld)).toBe(true);
      expect(hasKey(signers, skNew)).toBe(false);

      await buildSignSubmit({
        action: "initiate",
        walletId,
        userId: G1_USER,
        classicSigners: [g1],
        newSigner: skNew,
        step: "initiate-a1",
      });

      // Đọc số phiếu thật (initiator = phiếu 1 theo v2) → approve tới đủ ngưỡng 2.
      let status = await readStatus(account1);
      let approvals = (status.approvals as unknown[]).length;
      if (approvals < 2) {
        await buildSignSubmit({
          action: "approve",
          walletId,
          userId: G2_USER,
          classicSigners: [g2],
          step: "approve-a1",
        });
        status = await readStatus(account1);
        approvals = (status.approvals as unknown[]).length;
      }
      expect(approvals).toBeGreaterThanOrEqual(2);

      // TIMELOCK THẬT: chờ contract báo hết.
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const remaining = (await simulateRead({
          contractId: REGISTRY,
          method: "timelock_remaining",
          args: finalizeArgs({ wallet: account1 }),
        })) as bigint | number;
        if (Number(remaining) === 0) break;
        await new Promise((r) => setTimeout(r, 3_000));
      }

      const done = await finalizeRecovery(gateway, REGISTRY, { walletId, userId: OWNER1_USER });
      txEvidence.push({ step: "finalize-a1", hash: done.hash });
      expect(done.status).toBe("SUCCESS");
      const finalizedAt = Date.now();

      // GROUND TRUTH TỪ SMART ACCOUNT (không phải registry): khoá đã xoay,
      // địa chỉ ví KHÔNG đổi, last_rotation có dấu.
      signers = await accountSigners(account1);
      expect(hasKey(signers, skNew)).toBe(true);
      expect(hasKey(signers, skOld)).toBe(false);
      const lastRotation = (await simulateRead({
        contractId: account1,
        method: "last_rotation",
        args: [],
      })) as bigint | number | null;
      expect(Number(lastRotation)).toBeGreaterThan(0);

      // COOLDOWN: ngay sau xoay, MỌI chữ ký bị chối (kể cả khoá mới) — mã 101.
      const duringCooldown = await invokeAccountAs({
        account: account1,
        method: "update_context_rule_name",
        args: [xdr.ScVal.scvU32(0), xdr.ScVal.scvString("owner-renamed")],
        kp: skNew,
      }).catch((e) => e);
      expect(duringCooldown).toBeInstanceOf(StellarServiceError);
      expect(contractErrorCode((duringCooldown as StellarServiceError).message)).toBe(
        "CONTRACT_ERROR:CooldownActive",
      );

      // HẾT cooldown: khoá MỚI ký một giao dịch của ví → SUCCESS.
      const waitMs = finalizedAt + (COOLDOWN_SECS + 8) * 1000 - Date.now();
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      const newKeyWorks = await invokeAccountAs({
        account: account1,
        method: "update_context_rule_name",
        args: [xdr.ScVal.scvU32(0), xdr.ScVal.scvString("owner")],
        kp: skNew,
        step: "new-key-signs-a1",
      });
      expect(newKeyWorks.status).toBe("SUCCESS");

      // Khoá CŨ bị chối (UnauthorizedSigner phía OZ — chỉ cần chắc là CHẾT ở simulate).
      const oldKeyDies = await invokeAccountAs({
        account: account1,
        method: "update_context_rule_name",
        args: [xdr.ScVal.scvU32(0), xdr.ScVal.scvString("stolen")],
        kp: skOld,
      }).catch((e) => e);
      expect(oldKeyDies).toBeInstanceOf(StellarServiceError);
      expect((oldKeyDies as StellarServiceError).message).toStartWith("SIMULATION_FAILED:");
    },
    300_000,
  );

  testIt(
    "luồng 3 — VETO KHẨN: initiate rồi VÍ tự ký chặn; approve sau veto chết đúng mã",
    async () => {
      const walletId = await seedWalletRow({
        ownerUser: OWNER2_USER,
        address: account2,
        timelockSecs: 3600, // dài — veto phải chặn TRƯỚC khi hết
      });
      await buildSignSubmit({
        action: "register",
        walletId,
        userId: OWNER2_USER,
        accountSigner: skW2,
        step: "register-a2",
      });
      await buildSignSubmit({
        action: "initiate",
        walletId,
        userId: G1_USER,
        classicSigners: [g1],
        newSigner: skNew,
        step: "initiate-a2",
      });
      await buildSignSubmit({
        action: "veto",
        walletId,
        userId: OWNER2_USER,
        accountSigner: skW2,
        step: "veto-a2",
      });

      const err = await buildSignSubmit({
        action: "approve",
        walletId,
        userId: G2_USER,
        classicSigners: [g2],
        step: "approve-after-veto-a2",
      }).catch((e) => e);
      expect(err).toBeInstanceOf(StellarServiceError);
      const code = contractErrorCode((err as StellarServiceError).message) ?? "NO_CONTRACT_CODE";
      expect(["CONTRACT_ERROR:RecoveryCancelled", "CONTRACT_ERROR:NoActiveRecovery"]).toContain(
        code,
      );
      // Khoá gốc của ví 2 vẫn sống sau veto (không có xoay nào xảy ra).
      const signers = await accountSigners(account2);
      expect(hasKey(signers, skW2)).toBe(true);
    },
    300_000,
  );
});
