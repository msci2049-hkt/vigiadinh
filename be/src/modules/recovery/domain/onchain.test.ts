// Test hermetic tầng thuần on-chain (PHA 5.2) — không mạng, không DB.
// Trọng tâm: whitelist /submit (ví phí chỉ trả tiền cho invoke registry hợp lệ
// trên ĐÚNG ví) + dịch mã lỗi contract.
import { describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import {
  actorAddressFromArgs,
  approveArgs,
  contractErrorCode,
  externalSignerScVal,
  initiateArgs,
  RECOVERY_METHODS,
  RecoveryOnchainError,
  registerArgs,
  validateSignedSubmission,
  vetoArgs,
} from "./onchain";

// Registry v2 (audit P0) — giá trị test, không cần trùng env.
const REGISTRY = "CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY";
const VERIFIER = "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const KEY32_B64 = Buffer.alloc(32, 7).toString("base64");
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
      initiateArgs({
        wallet: WALLET,
        newSignerVerifier: VERIFIER,
        newSignerKeyBase64: KEY32_B64,
        initiator: OTHER,
      }),
      approveArgs({ wallet: WALLET, guardian: OTHER }),
      vetoArgs({ wallet: WALLET }),
    ]) {
      const first = args[0];
      if (!first) throw new Error("args rỗng");
      expect(Address.fromScAddress(first.address()).toString()).toBe(WALLET);
    }
  });

  it("initiate v2: arg[1] là Signer::External (Vec[Symbol, Address, Bytes])", () => {
    const args = initiateArgs({
      wallet: WALLET,
      newSignerVerifier: VERIFIER,
      newSignerKeyBase64: KEY32_B64,
      initiator: OTHER,
    });
    expect(args).toHaveLength(3);
    const signer = args[1]?.vec();
    if (!signer) throw new Error("arg[1] không phải vec");
    expect(signer[0]?.sym().toString()).toBe("External");
    expect(Address.fromScAddress(signer[1]?.address() as xdr.ScAddress).toString()).toBe(VERIFIER);
    expect(signer[2]?.bytes().length).toBe(32);
  });

  it("externalSignerScVal: key ngoài [32,96] byte hoặc không phải base64 → chối", () => {
    expect(() =>
      externalSignerScVal({ verifier: VERIFIER, keyBase64: Buffer.alloc(8).toString("base64") }),
    ).toThrow(RecoveryOnchainError);
    expect(() =>
      externalSignerScVal({ verifier: VERIFIER, keyBase64: Buffer.alloc(100).toString("base64") }),
    ).toThrow(RecoveryOnchainError);
  });
});

describe("actorAddressFromArgs — người duyệt = THAM SỐ lời gọi, không phải source", () => {
  it("approve: guardian = args[1]", () => {
    const args = approveArgs({ wallet: WALLET, guardian: OTHER });
    expect(actorAddressFromArgs(RECOVERY_METHODS.approve, args)).toBe(OTHER);
  });

  it("initiate: initiator = args[2] (arg CUỐI, sau Signer mới)", () => {
    const args = initiateArgs({
      wallet: WALLET,
      newSignerVerifier: VERIFIER,
      newSignerKeyBase64: KEY32_B64,
      initiator: OTHER,
    });
    expect(actorAddressFromArgs(RECOVERY_METHODS.initiate, args)).toBe(OTHER);
  });

  it("method không chở người duyệt (veto/register/finalize) → null, không đoán", () => {
    expect(actorAddressFromArgs(RECOVERY_METHODS.veto, vetoArgs({ wallet: WALLET }))).toBeNull();
    expect(actorAddressFromArgs(RECOVERY_METHODS.finalize, [])).toBeNull();
  });

  it("B5: tx giả có 'source'/credentials là VÍ PHÍ ≠ guardian → vẫn lấy đúng THAM SỐ", () => {
    // Ví phí (source account thật của mọi tx sponsor — GCJT4U… trên production)
    // ký credentials; guardian thật chỉ nằm trong args của lời gọi.
    const feeSponsor = Keypair.random().publicKey();
    const entry = makeEntry({ signer: feeSponsor });
    const validated = validateSignedSubmission({
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      entriesXdr: [entry],
    });
    const actor = actorAddressFromArgs(validated.method, validated.args);
    expect(actor).toBe(OTHER);
    expect(actor).not.toBe(feeSponsor);
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
        makeEntry({ method: "cancel_recovery", args: vetoArgs({ wallet: WALLET }) }),
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
