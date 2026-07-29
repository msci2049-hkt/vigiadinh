// Mục cắm SPENDING-LIMIT POLICY vào rule 0 NGAY trong tx deploy (D1 lô policy).
//
// Cùng cơ chế với recovery-link: `__constructor` của smart-account gỡ mục
// registry ra rồi đưa PHẦN CÒN LẠI của map `policies` cho OZ
// `add_context_rule(Default, "owner", signers, policies)` — nghĩa là mọi mục
// policy thường trong map được install vào RULE 0 ngay khi ví ra đời, CÙNG
// chữ ký deploy, không cần ceremony passkey thứ hai và không có cửa sổ nào
// ví sống thiếu trần cứng.
//
// DefaultInstallParams {period_ledgers, spending_limit, token} — key ScMap theo
// thứ tự alphabet (canonical XDR), đúng công thức đã chứng minh on-chain ở BE
// e2e spending-limit-default ca 6 (add_policy đường Default, chối #3221 ca 8).
//
// D2 — trần cứng: 20.000 XLM / ~1 ngày ledger (17280 ledger ≈ 5s/ledger); gấp
// đôi daily mềm mặc định (10.000) để ngưỡng mềm có chỗ nới mà không đụng trần.
// D4 — thiếu env policy/SAC → trả null: ví VẪN ra đời (không cụt đường tạo ví),
// Cài đặt sẽ hiện nhắc "Bật khoá chi tiêu" (đường D3 cho ví cũ).
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { PolicyConfig } from "smart-account-kit";
import { env } from "@/lib/env";

export const ONCHAIN_CAP_STROOPS = 200_000_000_000n; // 20.000 XLM
export const ONCHAIN_PERIOD_LEDGERS = 17_280; // ~1 ngày (ledger ≈ 5s)

/** ScVal DefaultInstallParams — PHẢI khớp bản BE build cho ví cũ (D3). */
export function spendingLimitInstallParamsScVal(sacContractId: string): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("period_ledgers"),
      val: xdr.ScVal.scvU32(ONCHAIN_PERIOD_LEDGERS),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("spending_limit"),
      val: nativeToScVal(ONCHAIN_CAP_STROOPS, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("token"),
      val: new Address(sacContractId).toScVal(),
    }),
  ]);
}

/**
 * Mục policy hạn mức cho `kit.createWallet` — null khi CHƯA cấu hình đủ env
 * (policy + SAC): khác registry (thiếu là CHẶN tạo ví), thiếu trần cứng thì ví
 * vẫn phải ra đời được — D4.
 */
export function spendingLimitConstructorPolicy(): PolicyConfig | null {
  const policy = env.VITE_SPENDING_LIMIT_POLICY;
  const sac = env.VITE_SAC_NATIVE;
  if (!policy || !sac) return null;
  return {
    address: policy,
    type: "custom",
    installParams: spendingLimitInstallParamsScVal(sac),
  };
}

/** Entry BE trả về KHÔNG phải add_policy đúng cấu hình — dấu hiệu bị tráo. */
export class AddPolicyEntryMismatchError extends Error {
  constructor() {
    super("ADD_POLICY_ENTRY_MISMATCH");
    this.name = "AddPolicyEntryMismatchError";
  }
}

/**
 * Chống ký mù cho đường D3 (khuôn auth-entry-guard P0-1): TRƯỚC khi đưa entry
 * cho passkey, đối chiếu với BẢN GỐC FE tự dựng — `add_policy(rule 0, policy
 * từ env CỦA MÌNH, DefaultInstallParams chuẩn)` trên CHÍNH ví đang mở. BE bị
 * chiếm mà tráo entry (vd transfer) thì chối ở đây, sinh trắc học chưa kịp bật.
 */
export function assertAddPolicyEntries(entriesXdr: string[], walletAddress: string): void {
  const policy = env.VITE_SPENDING_LIMIT_POLICY;
  const sac = env.VITE_SAC_NATIVE;
  if (!policy || !sac) throw new AddPolicyEntryMismatchError();
  const expectedArgs = [
    xdr.ScVal.scvU32(0),
    new Address(policy).toScVal(),
    spendingLimitInstallParamsScVal(sac),
  ].map((v) => v.toXDR("base64"));

  let matched = 0;
  for (const b64 of entriesXdr) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64");
    const invocation = entry.rootInvocation();
    if (
      invocation.function().switch() !==
      xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()
    ) {
      throw new AddPolicyEntryMismatchError();
    }
    const call = invocation.function().contractFn();
    if (Address.fromScAddress(call.contractAddress()).toString() !== walletAddress) {
      throw new AddPolicyEntryMismatchError();
    }
    if (call.functionName().toString() !== "add_policy") throw new AddPolicyEntryMismatchError();
    const got = call.args().map((v) => v.toXDR("base64"));
    if (got.length !== expectedArgs.length || got.some((g, i) => g !== expectedArgs[i])) {
      throw new AddPolicyEntryMismatchError();
    }
    matched += 1;
  }
  if (matched === 0) throw new AddPolicyEntryMismatchError();
}
