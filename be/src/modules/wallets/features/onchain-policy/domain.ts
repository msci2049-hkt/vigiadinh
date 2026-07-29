// THUẦN domain cho D3 — dựng args `add_policy(rule 0, policy, DefaultInstallParams)`
// và VALIDATE entry đã ký trước khi ví phí nộp hộ (khuôn validateSignedTransfer:
// bước cuối không kiểm lại thì mọi cổng phía trước vô nghĩa — ví phí không được
// ký bừa entry lạ).
//
// DefaultInstallParams — key ScMap PHẢI theo thứ tự alphabet (canonical XDR):
// period_ledgers < spending_limit < token. Công thức đã chứng minh on-chain ở
// e2e spending-limit-default (ca 6, LÔ 2.5).
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { ONCHAIN_CAP_STROOPS, ONCHAIN_PERIOD_LEDGERS } from "../../domain/spending-policy";

/** Rule 0 = owner Default (constructor) — nơi trần cứng phải đứng. */
export const OWNER_RULE_ID = 0;

export class OnchainPolicyError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "OnchainPolicyError";
  }
}

function fail(code: string): never {
  throw new OnchainPolicyError(code);
}

export function defaultInstallParamsScVal(sacContractId: string): xdr.ScVal {
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

export function addPolicyArgs(policyContractId: string, sacContractId: string): xdr.ScVal[] {
  return [
    xdr.ScVal.scvU32(OWNER_RULE_ID),
    new Address(policyContractId).toScVal(),
    defaultInstallParamsScVal(sacContractId),
  ];
}

/**
 * Entry đã ký phải là ĐÚNG lời gọi ta build: `add_policy` trên CHÍNH ví của
 * người gọi, policy + install params đúng cấu hình server. Sai bất kỳ đâu →
 * chối, ví phí không nộp.
 */
export function validateSignedAddPolicy(input: {
  walletAddress: string;
  policyContractId: string;
  sacContractId: string;
  entriesXdr: string[];
}): { entries: xdr.SorobanAuthorizationEntry[]; args: xdr.ScVal[] } {
  if (input.entriesXdr.length === 0) fail("NO_ENTRIES");
  if (input.entriesXdr.length > 2) fail("TOO_MANY_ENTRIES");

  const entries: xdr.SorobanAuthorizationEntry[] = [];
  for (const b64 of input.entriesXdr) {
    try {
      entries.push(xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64"));
    } catch {
      fail("MALFORMED_ENTRY_XDR");
    }
  }

  for (const entry of entries) {
    if (entry.credentials().switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
      fail("CREDENTIALS_NOT_ADDRESS");
    }
    const invocation = entry.rootInvocation();
    if (invocation.subInvocations().length > 0) fail("SUB_INVOCATIONS_FORBIDDEN");
    if (
      invocation.function().switch() !==
      xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()
    ) {
      fail("NOT_CONTRACT_FN");
    }
    const call = invocation.function().contractFn();
    if (Address.fromScAddress(call.contractAddress()).toString() !== input.walletAddress) {
      fail("WRONG_CONTRACT");
    }
    if (call.functionName().toString() !== "add_policy") fail("METHOD_NOT_ALLOWED");
    // Args phải khớp NGUYÊN VĂN bản server build (rule 0 + policy + params chuẩn)
    // — so bằng XDR canonical, không so từng trường.
    const expected = addPolicyArgs(input.policyContractId, input.sacContractId);
    const got = call.args();
    if (got.length !== expected.length) fail("ARGS_MISMATCH");
    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const act = got[i];
      if (!exp || !act || exp.toXDR("base64") !== act.toXDR("base64")) fail("ARGS_MISMATCH");
    }
  }

  return { entries, args: addPolicyArgs(input.policyContractId, input.sacContractId) };
}
