// E2E TESTNET THẬT — HẠN MỨC ON-CHAIN (LÔ 3). Chứng minh bằng tx thật:
// spending-limit policy (vỏ OZ, contracts/spending-limit-policy) gắn vào ví
// hợp đồng qua `add_context_rule(CallContract(SAC))` và CHẶN chi tiêu ở
// __check_auth — không đi qua backend, backend sập cũng không đổi được.
//
//   RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/spending-limit.e2e
//
// 5 ca:  1. dưới hạn mức → pass · 2. một lệnh vượt → CHỐI (#3221)
//        3. cộng dồn vượt → CHỐI (#3221) · 4. qua cửa sổ → pass lại
//        5. ⚠️ BYPASS ĐO ĐƯỢC: ký cùng lệnh bằng RULE 0 (Default) → pass —
//           hạn mức hiện ràng buộc THEO ĐƯỜNG KÝ (nợ đã khai trong
//           docs/AUDIT §2.3; chặn tuyệt đối cần policy cho rule Default).
//
// Ví bằng chứng: signer External(verifier-ed25519) như onchain.e2e — cùng
// đường __check_auth với passkey, chạy được không cần authenticator.
import { afterAll, describe, expect, it } from "bun:test";
import { Address, hash, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { env } from "@/env";
import { externalSignerScVal } from "@/modules/recovery";
import {
  buildInvokeTx,
  invokeWithSignedEntries,
  StellarServiceError,
  simulateRead,
  withRpc,
} from "@/services/stellar/stellar.service";
import { balanceArgs, transferArgs } from "../../domain/transfer";
import { deployEvidenceWallet, friendbot, fundContractWallet } from "./spending-limit.e2e-helpers";

if (env.STELLAR_NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015") {
  throw new Error("spending-limit.e2e CHỈ chạy testnet — friendbot + phí thật không đi cùng nhau.");
}

const enabled =
  process.env.RUN_TESTNET_E2E === "1" &&
  Boolean(env.FEE_WALLET_SECRET) &&
  Boolean(env.CONTRACT_ID_SAC_NATIVE);
const testIt = enabled ? it : it.skip;
if (!enabled) {
  console.warn(
    "SKIP spending-limit e2e: cần RUN_TESTNET_E2E=1 + FEE_WALLET_SECRET + CONTRACT_ID_SAC_NATIVE",
  );
}

const SAC = env.CONTRACT_ID_SAC_NATIVE ?? "";
/** Policy đã deploy (LÔ 3): vỏ OZ spending_limit — xem docs/evidence/TESTNET.md. */
const POLICY =
  process.env.E2E_SPENDING_LIMIT_POLICY ??
  "CABZ6H4DPPTUGAAN7TI74AWMMWF54IHHDNUXXN2GDZZVTMFDWWJLXBK2";
/** 50 XLM / 60 ledger (~5 phút) — cửa sổ ngắn để ca 4 chạy được trong test.
 * Khuyến nghị ví thật: 17280 ledger (~1 ngày), docs/AUDIT §2.3. */
const LIMIT_STROOPS = 500_000_000n;
const PERIOD_LEDGERS = 60;
/** Rule 0 = owner (constructor); rule mới của LÔ 3 là rule kế tiếp. */
const SPEND_RULE_ID = 1;

const skOwner = Keypair.random();
const funder = Keypair.random();
const recipient = Keypair.random();
const txEvidence: Array<{ step: string; hash: string }> = [];
let walletC = "";

function signerScVal(kp: Keypair): xdr.ScVal {
  return externalSignerScVal({
    verifier:
      process.env.E2E_VERIFIER_ED25519 ??
      "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT",
    keyBase64: kp.rawPublicKey().toString("base64"),
  });
}

/** Ký entry của ví bằng ed25519 — digest OZ: sha256(payload ++ ruleIds.toXDR()).
 * `ruleIds` là THAM SỐ: ca 1-4 ký rule 1 (có policy), ca 5 ký rule 0 (đo bypass). */
function signWalletEntry(entryB64: string, validUntil: number, ruleIdNums: number[]): string {
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
  const ruleIds = xdr.ScVal.scvVec(ruleIdNums.map((n) => xdr.ScVal.scvU32(n)));
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

/** Invoke một method của/về ví: build (recording) → ký entry ví theo ruleIds → submit. */
async function invokeSigned(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  ruleIds: number[];
  step: string;
}): Promise<string> {
  const built = await buildInvokeTx({
    contractId: input.contractId,
    method: input.method,
    args: input.args,
  });
  const signed = built.authEntriesXdr.map((e2) =>
    signWalletEntry(e2, built.latestLedger + 500, input.ruleIds),
  );
  const res = await invokeWithSignedEntries({
    contractId: input.contractId,
    method: input.method,
    args: input.args,
    authEntries: signed.map((s) => xdr.SorobanAuthorizationEntry.fromXDR(s, "base64")),
  });
  if (res.status !== "SUCCESS") throw new Error(`${input.step}: ${res.status}`);
  txEvidence.push({ step: input.step, hash: res.hash });
  return res.hash;
}

/** Chuyển XLM từ ví C… — đường tiền thật, ký theo ruleIds chỉ định. */
async function transferViaRule(amount: bigint, ruleIds: number[], step: string): Promise<string> {
  return invokeSigned({
    contractId: SAC,
    method: "transfer",
    args: transferArgs({ from: walletC, to: recipient.publicKey(), amount }),
    ruleIds,
    step,
  });
}

/** Vượt hạn mức → simulation (enforcing, có chữ ký) CHẾT với mã lỗi contract. */
async function expectLimitRejected(amount: bigint, step: string): Promise<string> {
  const err = await transferViaRule(amount, [SPEND_RULE_ID], step).catch((e) => e);
  expect(err).toBeInstanceOf(StellarServiceError);
  const msg = (err as Error).message;
  expect(msg).toContain("SIMULATION_FAILED");
  // SpendingLimitError::SpendingLimitExceeded = 3221 (OZ 0.7.2).
  expect(msg).toContain("3221");
  return msg;
}

async function latestLedger(): Promise<number> {
  return withRpc(async (server) => (await server.getLatestLedger()).sequence);
}

async function balanceOf(address: string): Promise<bigint> {
  const raw = await simulateRead({
    contractId: SAC,
    method: "balance",
    args: balanceArgs(address),
  });
  return BigInt(raw as string | number | bigint);
}

afterAll(() => {
  if (txEvidence.length > 0) {
    console.warn("=== TX EVIDENCE LÔ 3 (chép vào docs/evidence/TESTNET.md) ===");
    console.warn(`policy: https://stellar.expert/explorer/testnet/contract/${POLICY}`);
    console.warn(`wallet: https://stellar.expert/explorer/testnet/contract/${walletC}`);
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — HẠN MỨC ON-CHAIN (spending-limit policy, LÔ 3)", () => {
  testIt(
    "chuẩn bị: deploy ví bằng chứng + nạp 200 XLM + gắn rule CallContract(SAC) chở policy",
    async () => {
      await friendbot(funder);
      await friendbot(recipient);
      walletC = await deployEvidenceWallet(signerScVal(skOwner), txEvidence);
      await fundContractWallet(funder, walletC, 2_000_000_000n, txEvidence);

      // add_context_rule(CallContract(SAC), "spend-limit", None, [owner], {policy: params})
      // — ký bằng RULE 0 (rule owner Default duyệt thay đổi cấu hình ví).
      const params = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("period_ledgers"),
          val: xdr.ScVal.scvU32(PERIOD_LEDGERS),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("spending_limit"),
          val: nativeToScVal(LIMIT_STROOPS, { type: "i128" }),
        }),
      ]);
      await invokeSigned({
        contractId: walletC,
        method: "add_context_rule",
        args: [
          xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("CallContract"), new Address(SAC).toScVal()]),
          nativeToScVal("spend-limit", { type: "string" }),
          xdr.ScVal.scvVoid(),
          xdr.ScVal.scvVec([signerScVal(skOwner)]),
          xdr.ScVal.scvMap([
            new xdr.ScMapEntry({ key: new Address(POLICY).toScVal(), val: params }),
          ]),
        ],
        ruleIds: [0],
        step: "add-context-rule-spend-limit",
      });

      // Đọc lại từ CHAIN: rule 1 phải chở đúng policy; policy phải giữ đúng hạn mức.
      const rule = (await simulateRead({
        contractId: walletC,
        method: "get_context_rule",
        args: [xdr.ScVal.scvU32(SPEND_RULE_ID)],
      })) as { policies: string[] };
      expect(rule.policies.map(String)).toContain(POLICY);
      const data = (await simulateRead({
        contractId: POLICY,
        method: "get_spending_limit_data",
        args: [xdr.ScVal.scvU32(SPEND_RULE_ID), new Address(walletC).toScVal()],
      })) as { spending_limit: bigint; period_ledgers: number };
      expect(BigInt(data.spending_limit)).toBe(LIMIT_STROOPS);
      expect(Number(data.period_ledgers)).toBe(PERIOD_LEDGERS);
    },
    300_000,
  );

  testIt(
    "ca 1 — 10 XLM dưới hạn mức, ký rule 1 → PASS, người nhận nhận đủ",
    async () => {
      const before = await balanceOf(recipient.publicKey());
      await transferViaRule(100_000_000n, [SPEND_RULE_ID], "ca1-under-limit-10xlm");
      expect((await balanceOf(recipient.publicKey())) - before).toBe(100_000_000n);
    },
    300_000,
  );

  testIt(
    "ca 2 — 60 XLM vượt hạn mức một lệnh → BỊ CHỐI on-chain (#3221)",
    async () => {
      const ledger = await latestLedger();
      const msg = await expectLimitRejected(600_000_000n, "ca2-over-limit-60xlm");
      console.warn(`ca2 REJECTED @ledger~${ledger}: ${msg.slice(0, 220)}`);
    },
    300_000,
  );

  testIt(
    "ca 3 — cộng dồn: +20 XLM pass (tổng 30), +25 XLM nữa → BỊ CHỐI (tổng sẽ 55 > 50)",
    async () => {
      await transferViaRule(200_000_000n, [SPEND_RULE_ID], "ca3a-cumulative-20xlm-pass");
      const ledger = await latestLedger();
      const msg = await expectLimitRejected(250_000_000n, "ca3b-cumulative-25xlm");
      console.warn(`ca3 REJECTED @ledger~${ledger}: ${msg.slice(0, 220)}`);
    },
    300_000,
  );

  testIt(
    "ca 4 — chờ qua cửa sổ (60 ledger ~5') → 25 XLM PASS trở lại",
    async () => {
      const start = await latestLedger();
      const target = start + PERIOD_LEDGERS + 5;
      // Poll ledger — không sleep mù: testnet ~5s/ledger → ~5-6 phút.
      while ((await latestLedger()) < target) {
        await new Promise((r) => setTimeout(r, 20_000));
      }
      await transferViaRule(250_000_000n, [SPEND_RULE_ID], "ca4-after-window-25xlm");
    },
    900_000,
  );

  testIt(
    "ca 5 — ⚠️ ĐO NỢ BYPASS: cùng 60 XLM nhưng ký RULE 0 (Default) → PASS (policy không chạy)",
    async () => {
      // Đây KHÔNG phải tính năng — là bằng chứng trung thực rằng hạn mức OZ
      // 0.7.2 ràng buộc THEO ĐƯỜNG KÝ khi ví còn rule Default không policy.
      // Ghi vào docs làm nợ: chặn tuyệt đối cần policy cho rule Default.
      const before = await balanceOf(recipient.publicKey());
      await transferViaRule(600_000_000n, [0], "ca5-bypass-rule0-60xlm");
      expect((await balanceOf(recipient.publicKey())) - before).toBe(600_000_000n);
    },
    300_000,
  );
});
