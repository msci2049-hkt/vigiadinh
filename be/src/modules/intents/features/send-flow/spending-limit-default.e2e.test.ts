// E2E TESTNET THẬT — VÁ NỢ CA 5 (LÔ 2.5, 2026-07-29): policy hạn mức bản
// Default-capable (contracts/spending-limit-policy, deploy từ release v0.1.1)
// gắn được vào RULE 0 (Default) qua `add_policy` với DefaultInstallParams
// {period_ledgers, spending_limit, token}. Sau khi gắn, KHÔNG còn đường ký
// nào vượt hạn mức: rule 0 — đường bypass đo được ở ca 5 cũ — giờ bị chặn
// #3221 ngay trong __check_auth, còn việc QUẢN TRỊ ví qua rule 0 vẫn chạy.
//
//   RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/spending-limit-default.e2e
//
// 4 ca:  6. gắn policy vào rule 0 (DefaultInstallParams chở token SAC)
//        7. 10 XLM ký rule 0 → PASS và BỊ ĐO (cached_total_spent tăng)
//        8. 60 XLM ký rule 0 → BỊ CHỐI (#3221) — lỗ ca 5 ĐÃ VÁ
//        9. admin op (add_context_rule) ký rule 0 → PASS — policy không khoá quản trị
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
    "SKIP spending-limit-default e2e: cần RUN_TESTNET_E2E=1 + FEE_WALLET_SECRET + CONTRACT_ID_SAC_NATIVE",
  );
}

const SAC = env.CONTRACT_ID_SAC_NATIVE ?? "";
/** Policy Default-capable — release v0.1.1, StellarExpert verified (VERIFY-CONTRACT §9). */
const POLICY =
  process.env.E2E_SPENDING_LIMIT_POLICY ??
  "CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK";
/** 50 XLM / 60 ledger — cùng cấu hình bộ bằng chứng LÔ 3 cho dễ so. */
const LIMIT_STROOPS = 500_000_000n;
const PERIOD_LEDGERS = 60;
/** Rule 0 = owner Default (constructor) — ĐÍCH của lô vá này. */
const OWNER_RULE_ID = 0;

const skOwner = Keypair.random();
const funder = Keypair.random();
const recipient = Keypair.random();
const txEvidence: Array<{ step: string; hash: string }> = [];
let walletC = "";

function invokeAsOwner(input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  step: string;
}): Promise<string> {
  return invokeSignedAs({ ...input, ruleIds: [OWNER_RULE_ID], owner: skOwner, txEvidence });
}

async function transferViaRule0(amount: bigint, step: string): Promise<string> {
  return invokeAsOwner({
    contractId: SAC,
    method: "transfer",
    args: transferArgs({ from: walletC, to: recipient.publicKey(), amount }),
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
      "=== TX EVIDENCE LÔ 2.5 — RULE DEFAULT ĐÃ VÁ (chép vào docs/evidence/TESTNET.md) ===",
    );
    console.warn(`policy: https://stellar.expert/explorer/testnet/contract/${POLICY}`);
    console.warn(`wallet: https://stellar.expert/explorer/testnet/contract/${walletC}`);
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — policy hạn mức TRÊN RULE 0 DEFAULT (vá nợ ca 5)", () => {
  testIt(
    "ca 6 — deploy ví bằng chứng + nạp XLM + add_policy(rule 0, DefaultInstallParams)",
    async () => {
      await friendbot(funder);
      await friendbot(recipient);
      walletC = await deployEvidenceWallet(evidenceSignerScVal(skOwner), txEvidence);
      await fundContractWallet(funder, walletC, 2_000_000_000n, txEvidence);

      // DefaultInstallParams — key ScMap PHẢI theo thứ tự alphabet (canonical XDR):
      // period_ledgers < spending_limit < token.
      const params = xdr.ScVal.scvMap([
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
      await invokeAsOwner({
        contractId: walletC,
        method: "add_policy",
        args: [xdr.ScVal.scvU32(OWNER_RULE_ID), new Address(POLICY).toScVal(), params],
        step: "add-policy-rule0-default",
      });

      // Đọc lại từ CHAIN: rule 0 chở policy; policy pin đúng token + hạn mức.
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
    "ca 7 — 10 XLM ký RULE 0 → PASS và BỊ ĐO (không phải cho qua suông)",
    async () => {
      await transferViaRule0(100_000_000n, "ca7-rule0-under-limit-10xlm");
      expect(await spentTotal()).toBe(100_000_000n);
    },
    300_000,
  );

  testIt(
    "ca 8 — 60 XLM ký RULE 0 → BỊ CHỐI (#3221): lỗ bypass ca 5 ĐÃ ĐÓNG",
    async () => {
      const err = await transferViaRule0(600_000_000n, "ca8-rule0-over-limit-60xlm").catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(StellarServiceError);
      const msg = (err as Error).message;
      expect(msg).toContain("SIMULATION_FAILED");
      // SpendingLimitError::SpendingLimitExceeded = 3221 (OZ 0.7.2).
      expect(msg).toContain("3221");
      console.warn(`ca8 REJECTED: ${msg.slice(0, 220)}`);
    },
    300_000,
  );

  testIt(
    "ca 9 — admin op (add_context_rule) ký RULE 0 → PASS: policy không khoá quản trị ví",
    async () => {
      await invokeAsOwner({
        contractId: walletC,
        method: "add_context_rule",
        args: [
          xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("CallContract"), new Address(walletC).toScVal()]),
          nativeToScVal("admin-proof", { type: "string" }),
          xdr.ScVal.scvVoid(),
          xdr.ScVal.scvVec([evidenceSignerScVal(skOwner)]),
          xdr.ScVal.scvMap([]),
        ],
        step: "ca9-admin-op-add-rule-via-rule0",
      });
      // Admin op KHÔNG bị cộng vào tổng chi.
      expect(await spentTotal()).toBe(100_000_000n);
    },
    300_000,
  );
});
