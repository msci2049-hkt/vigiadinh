// E2E TESTNET THẬT — LÔ POLICY 2026-07-29 (D1): spending-limit policy cài vào
// RULE 0 NGAY TRONG TX DEPLOY qua map `policies` của __constructor — đúng đường
// FE `kit.createWallet({policies})` sẽ đi (policy-link.ts). Khác lô 2.5
// (add_policy SAU deploy), ở đây KHÔNG có tx thứ hai: ví chưa từng tồn tại
// một giây nào thiếu trần cứng.
//
//   RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/spending-limit-constructor.e2e
//
// 3 ca: 1. deploy(constructor chở DefaultInstallParams) → get_context_rule(0)
//          chở policy + get_metered_token = SAC (bằng chứng ca 1 §6 nửa on-chain)
//       2. 10 XLM ký rule 0 → PASS và BỊ ĐO
//       3. 60 XLM > trần → BỊ CHỐI #3221 (bằng chứng ca 11 §6)
import { afterAll, describe, expect, it } from "bun:test";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { env } from "@/env";
import { StellarServiceError, simulateRead } from "@/services/stellar/stellar.service";
import { transferArgs } from "../../domain/transfer";
import {
  deployEvidenceWallet,
  evidenceSignerScVal,
  friendbot,
  fundContractWallet,
  invokeSignedAs,
} from "./spending-limit.e2e-helpers";

if (env.STELLAR_NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015") {
  throw new Error("e2e này CHỈ chạy testnet — friendbot + phí thật không đi cùng nhau.");
}

const enabled =
  process.env.RUN_TESTNET_E2E === "1" &&
  Boolean(env.FEE_WALLET_SECRET) &&
  Boolean(env.CONTRACT_ID_SAC_NATIVE);
const testIt = enabled ? it : it.skip;
if (!enabled) {
  console.warn(
    "SKIP spending-limit-constructor e2e: cần RUN_TESTNET_E2E=1 + FEE_WALLET_SECRET + CONTRACT_ID_SAC_NATIVE",
  );
}

const SAC = env.CONTRACT_ID_SAC_NATIVE ?? "";
/** Policy Default-capable v0.1.1 — CÙNG contract production sẽ dùng. */
const POLICY =
  process.env.E2E_SPENDING_LIMIT_POLICY ??
  env.CONTRACT_ID_SPENDING_LIMIT_POLICY ??
  "CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK";
/** 50 XLM / 60 ledger — con số NHỎ cho testnet (friendbot chỉ cấp 10k). Đường
 * cài là thứ được chứng minh; giá trị production (20.000/17280) là config. */
const LIMIT_STROOPS = 500_000_000n;
const PERIOD_LEDGERS = 60;
const OWNER_RULE_ID = 0;

const skOwner = Keypair.random();
const funder = Keypair.random();
const recipient = Keypair.random();
const txEvidence: Array<{ step: string; hash: string }> = [];
let walletC = "";

/** DefaultInstallParams — key ScMap theo thứ tự alphabet (canonical XDR),
 * CÙNG công thức với FE policy-link.ts (spendingLimitInstallParamsScVal). */
function installParams(): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("period_ledgers"),
      val: xdr.ScVal.scvU32(PERIOD_LEDGERS),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("spending_limit"),
      val: nativeToScVal(LIMIT_STROOPS, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("token"),
      val: new Address(SAC).toScVal(),
    }),
  ]);
}

function transferViaRule0(amount: bigint, step: string): Promise<string> {
  return invokeSignedAs({
    contractId: SAC,
    method: "transfer",
    args: transferArgs({ from: walletC, to: recipient.publicKey(), amount }),
    ruleIds: [OWNER_RULE_ID],
    owner: skOwner,
    txEvidence,
    step,
  });
}

async function spentTotal(): Promise<bigint> {
  const data = (await simulateRead({
    contractId: POLICY,
    method: "get_spending_limit_data",
    args: [xdr.ScVal.scvU32(OWNER_RULE_ID), new Address(walletC).toScVal()],
  })) as { cached_total_spent: bigint };
  return BigInt(data.cached_total_spent);
}

afterAll(() => {
  if (txEvidence.length > 0) {
    console.warn(
      "=== TX EVIDENCE LÔ POLICY — D1 CONSTRUCTOR (chép vào docs/evidence/TESTNET.md) ===",
    );
    console.warn(`policy: https://stellar.expert/explorer/testnet/contract/${POLICY}`);
    console.warn(`wallet: https://stellar.expert/explorer/testnet/contract/${walletC}`);
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — D1: policy cài vào RULE 0 ngay trong CONSTRUCTOR", () => {
  testIt(
    "ca 1 — deploy ví với constructor policies → rule 0 chở policy, token đã pin",
    async () => {
      await friendbot(funder);
      await friendbot(recipient);
      walletC = await deployEvidenceWallet(
        evidenceSignerScVal(skOwner),
        txEvidence,
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: new Address(POLICY).toScVal(), val: installParams() }),
        ]),
      );
      await fundContractWallet(funder, walletC, 2_000_000_000n, txEvidence);

      // Đọc lại TỪ CHAIN: rule 0 chở policy; policy pin đúng token; chưa chi gì.
      const rule = (await simulateRead({
        contractId: walletC,
        method: "get_context_rule",
        args: [xdr.ScVal.scvU32(OWNER_RULE_ID)],
      })) as { policies: string[] };
      expect(rule.policies.map(String)).toContain(POLICY);
      const metered = (await simulateRead({
        contractId: POLICY,
        method: "get_metered_token",
        args: [xdr.ScVal.scvU32(OWNER_RULE_ID), new Address(walletC).toScVal()],
      })) as string | null;
      expect(String(metered)).toBe(SAC);
      expect(await spentTotal()).toBe(0n);
    },
    300_000,
  );

  testIt(
    "ca 2 — 10 XLM ký rule 0 → PASS và BỊ ĐO",
    async () => {
      await transferViaRule0(100_000_000n, "d1-rule0-under-limit-10xlm");
      expect(await spentTotal()).toBe(100_000_000n);
    },
    300_000,
  );

  testIt(
    "ca 3 — 60 XLM vượt trần constructor → BỊ CHỐI #3221 (trần sống từ giây 0)",
    async () => {
      const err = await transferViaRule0(600_000_000n, "d1-rule0-over-limit-60xlm").catch((e) => e);
      expect(err).toBeInstanceOf(StellarServiceError);
      const msg = (err as Error).message;
      expect(msg).toContain("SIMULATION_FAILED");
      expect(msg).toContain("3221");
      console.warn(`d1 ca3 REJECTED: ${msg.slice(0, 220)}`);
    },
    300_000,
  );
});
