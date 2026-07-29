// Test hermetic D3 — DefaultInstallParams + validate entry đã ký.
// Vector XDR GHIM CHÉO với FE policy-link.test.ts (cùng literal): hai bên dựng
// lệch nhau một byte là ví cũ và ví mới mang hai trần khác nhau.
import { describe, expect, it } from "bun:test";
import { Address, xdr } from "@stellar/stellar-sdk";
import {
  addPolicyArgs,
  defaultInstallParamsScVal,
  OWNER_RULE_ID,
  validateSignedAddPolicy,
} from "./domain";

const SAC_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const POLICY = "CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK";
const VECTOR_B64 =
  "AAAAEQAAAAEAAAADAAAADwAAAA5wZXJpb2RfbGVkZ2VycwAAAAAAAwAAQ4AAAAAPAAAADnNwZW5kaW5nX2xpbWl0AAAAAAAKAAAAAAAAAAAAAAAukO3QAAAAAA8AAAAFdG9rZW4AAAAAAAASAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5h";

function entryFor(input: {
  wallet: string;
  contract: string;
  fn: string;
  args: xdr.ScVal[];
}): string {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(input.wallet).toScAddress(),
        nonce: new xdr.Int64(1n),
        signatureExpirationLedger: 1000,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(input.contract).toScAddress(),
          functionName: input.fn,
          args: input.args,
        }),
      ),
      subInvocations: [],
    }),
  }).toXDR("base64");
}

// Một địa chỉ C hợp lệ bất kỳ đóng vai "ví" trong entry test.
const WALLET = "CBFCNHIOQN3N5IVSIVW4TTKYXZ73YQI4DZPADC6UCWF2XU35W4GVVWGW";

describe("onchain-policy domain (D3)", () => {
  it("vector XDR DefaultInstallParams khớp từng byte với FE", () => {
    expect(defaultInstallParamsScVal(SAC_TESTNET).toXDR("base64")).toBe(VECTOR_B64);
  });

  it("entry ĐÚNG (add_policy rule 0 + policy + params chuẩn) → qua", () => {
    const good = entryFor({
      wallet: WALLET,
      contract: WALLET,
      fn: "add_policy",
      args: addPolicyArgs(POLICY, SAC_TESTNET),
    });
    const validated = validateSignedAddPolicy({
      walletAddress: WALLET,
      policyContractId: POLICY,
      sacContractId: SAC_TESTNET,
      entriesXdr: [good],
    });
    expect(validated.entries.length).toBe(1);
    expect(validated.args.length).toBe(3);
  });

  it("entry gọi method KHÁC (transfer) → METHOD_NOT_ALLOWED — ví phí không ký bừa", () => {
    const bad = entryFor({
      wallet: WALLET,
      contract: WALLET,
      fn: "transfer",
      args: addPolicyArgs(POLICY, SAC_TESTNET),
    });
    expect(() =>
      validateSignedAddPolicy({
        walletAddress: WALLET,
        policyContractId: POLICY,
        sacContractId: SAC_TESTNET,
        entriesXdr: [bad],
      }),
    ).toThrow("METHOD_NOT_ALLOWED");
  });

  it("entry đổi RULE ID (rule 1 thay vì 0) → ARGS_MISMATCH", () => {
    const args = addPolicyArgs(POLICY, SAC_TESTNET);
    args[0] = xdr.ScVal.scvU32(OWNER_RULE_ID + 1);
    const bad = entryFor({ wallet: WALLET, contract: WALLET, fn: "add_policy", args });
    expect(() =>
      validateSignedAddPolicy({
        walletAddress: WALLET,
        policyContractId: POLICY,
        sacContractId: SAC_TESTNET,
        entriesXdr: [bad],
      }),
    ).toThrow("ARGS_MISMATCH");
  });

  it("entry trỏ CONTRACT KHÁC ví người gọi → WRONG_CONTRACT", () => {
    const bad = entryFor({
      wallet: POLICY, // credentials + invocation đều trỏ contract khác
      contract: POLICY,
      fn: "add_policy",
      args: addPolicyArgs(POLICY, SAC_TESTNET),
    });
    expect(() =>
      validateSignedAddPolicy({
        walletAddress: WALLET,
        policyContractId: POLICY,
        sacContractId: SAC_TESTNET,
        entriesXdr: [bad],
      }),
    ).toThrow("WRONG_CONTRACT");
  });

  it("không entry nào → NO_ENTRIES", () => {
    expect(() =>
      validateSignedAddPolicy({
        walletAddress: WALLET,
        policyContractId: POLICY,
        sacContractId: SAC_TESTNET,
        entriesXdr: [],
      }),
    ).toThrow("NO_ENTRIES");
  });
});
