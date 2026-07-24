// Test hermetic tầng thuần on-chain (PHA 5.2) — không mạng, không DB.
// Trọng tâm: whitelist /submit (ví phí chỉ trả tiền cho invoke registry hợp lệ
// trên ĐÚNG ví) + dịch mã lỗi contract.
import { describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import {
  approveArgs,
  contractErrorCode,
  initiateArgs,
  RECOVERY_METHODS,
  RecoveryOnchainError,
  registerArgs,
  validateSignedSubmission,
  vetoArgs,
} from "./onchain";

const REGISTRY = "CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V";
const WALLET = Keypair.random().publicKey();
const OTHER = Keypair.random().publicKey();

function makeEntry(input: {
  contract?: string;
  method?: string;
  args?: xdr.ScVal[];
  signer?: string;
  subInvocations?: xdr.SorobanAuthorizedInvocation[];
  sourceCredentials?: boolean;
}): string {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(input.contract ?? REGISTRY).toScAddress(),
        functionName: input.method ?? RECOVERY_METHODS.approve,
        args: input.args ?? approveArgs({ wallet: WALLET, guardian: OTHER }),
      }),
    ),
    subInvocations: input.subInvocations ?? [],
  });
  const credentials = input.sourceCredentials
    ? xdr.SorobanCredentials.sorobanCredentialsSourceAccount()
    : xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: new Address(input.signer ?? OTHER).toScAddress(),
          nonce: new xdr.Int64(1n),
          signatureExpirationLedger: 1000,
          signature: xdr.ScVal.scvVec([]),
        }),
      );
  return new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation: invocation }).toXDR(
    "base64",
  );
}

describe("recovery onchain args builders", () => {
  it("register: 4 args đúng kiểu (addr, vec addr, u32, u64)", () => {
    const args = registerArgs({
      wallet: WALLET,
      guardians: [OTHER],
      threshold: 2,
      timelockSecs: 86400,
    });
    expect(args).toHaveLength(4);
    expect(args[0]?.switch().name).toBe("scvAddress");
    expect(args[1]?.switch().name).toBe("scvVec");
    expect(args[2]?.switch().name).toBe("scvU32");
    expect(args[3]?.switch().name).toBe("scvU64");
  });

  it("initiate/approve/veto: arg đầu luôn là VÍ (khoá định danh registry)", () => {
    for (const args of [
      initiateArgs({ wallet: WALLET, newOwner: OTHER, initiator: OTHER }),
      approveArgs({ wallet: WALLET, guardian: OTHER }),
      vetoArgs({ wallet: WALLET, owner: OTHER }),
    ]) {
      const first = args[0];
      if (!first) throw new Error("args rỗng");
      expect(Address.fromScAddress(first.address()).toString()).toBe(WALLET);
    }
  });
});

describe("contractErrorCode — dịch mã lỗi từ sim error", () => {
  it("Error(Contract, #9) → ThresholdNotMet", () => {
    expect(contractErrorCode("SIMULATION_FAILED:...Error(Contract, #9)...")).toBe(
      "CONTRACT_ERROR:ThresholdNotMet",
    );
  });
  it("mã ngoài bảng giữ số, không throw", () => {
    expect(contractErrorCode("xx Error(Contract, #99) yy")).toBe("CONTRACT_ERROR:#99");
  });
  it("không match → null (caller giữ mã chung)", () => {
    expect(contractErrorCode("SIMULATION_FAILED:host error")).toBeNull();
  });
});

describe("validateSignedSubmission — whitelist trước khi ví phí trả tiền", () => {
  const base = { registryContractId: REGISTRY, walletAddress: WALLET };

  it("entry hợp lệ → trả method + args từ CHÍNH invocation đã ký", () => {
    const result = validateSignedSubmission({ ...base, entriesXdr: [makeEntry({})] });
    expect(result.method).toBe(RECOVERY_METHODS.approve);
    expect(result.entries).toHaveLength(1);
    const first = result.args[0];
    if (!first) throw new Error("args rỗng");
    expect(Address.fromScAddress(first.address()).toString()).toBe(WALLET);
  });

  const rejects: Array<[string, () => string[]]> = [
    // Contract ID hợp lệ về strkey nhưng KHÔNG phải registry (verifier spike).
    [
      "contract lạ",
      () => [makeEntry({ contract: "CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP" })],
    ],
    [
      "method ngoài whitelist (finalize không cần entry)",
      () => [makeEntry({ method: "finalize_recovery" })],
    ],
    ["method tuỳ tiện", () => [makeEntry({ method: "transfer" })]],
    [
      "ví lệch (entry ký cho ví khác)",
      () => [makeEntry({ args: approveArgs({ wallet: OTHER, guardian: OTHER }) })],
    ],
    [
      "source-account credentials (ví phí tự authorize — cấm)",
      () => [makeEntry({ sourceCredentials: true })],
    ],
    [
      "hai entry khác invocation",
      () => [
        makeEntry({}),
        makeEntry({ method: "cancel_recovery", args: vetoArgs({ wallet: WALLET, owner: OTHER }) }),
      ],
    ],
    ["XDR rác", () => ["not-xdr!!"]],
    ["rỗng", () => []],
    [
      "sub-invocation lén",
      () => [
        makeEntry({
          subInvocations: [
            new xdr.SorobanAuthorizedInvocation({
              function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
                new xdr.InvokeContractArgs({
                  contractAddress: new Address(REGISTRY).toScAddress(),
                  functionName: "approve_recovery",
                  args: [],
                }),
              ),
              subInvocations: [],
            }),
          ],
        }),
      ],
    ],
  ];
  for (const [name, entries] of rejects) {
    it(`chặn: ${name}`, () => {
      expect(() => validateSignedSubmission({ ...base, entriesXdr: entries() })).toThrow(
        RecoveryOnchainError,
      );
    });
  }
});
