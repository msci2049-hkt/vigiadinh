// Test hermetic tầng thuần gửi tiền (PHA 6 SEND) — không mạng, không DB.
// Trọng tâm: args transfer đúng shape SAC + whitelist /sign (ví phí chỉ trả tiền
// cho invoke transfer trên ĐÚNG SAC, từ ĐÚNG ví).
import { describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import { balanceArgs, SendError, transferArgs, validateSignedTransfer } from "./transfer";

const SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const WALLET = Keypair.random().publicKey();
const OTHER = Keypair.random().publicKey();

function makeEntry(input: {
  contract?: string;
  method?: string;
  args?: xdr.ScVal[];
  sourceCredentials?: boolean;
  subInvocations?: xdr.SorobanAuthorizedInvocation[];
}): string {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(input.contract ?? SAC).toScAddress(),
        functionName: input.method ?? "transfer",
        args: input.args ?? transferArgs({ from: WALLET, to: OTHER, amount: 100n }),
      }),
    ),
    subInvocations: input.subInvocations ?? [],
  });
  const credentials = input.sourceCredentials
    ? xdr.SorobanCredentials.sorobanCredentialsSourceAccount()
    : xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: new Address(WALLET).toScAddress(),
          nonce: new xdr.Int64(1n),
          signatureExpirationLedger: 1000,
          signature: xdr.ScVal.scvVec([]),
        }),
      );
  return new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation: invocation }).toXDR(
    "base64",
  );
}

describe("transferArgs", () => {
  it("3 args: from Address, to Address, amount i128", () => {
    const args = transferArgs({ from: WALLET, to: OTHER, amount: 12345n });
    expect(args).toHaveLength(3);
    expect(args[0]?.switch().name).toBe("scvAddress");
    expect(args[1]?.switch().name).toBe("scvAddress");
    expect(args[2]?.switch().name).toBe("scvI128");
  });
  it("amount ≤ 0 hoặc địa chỉ sai → SendError", () => {
    expect(() => transferArgs({ from: WALLET, to: OTHER, amount: 0n })).toThrow(SendError);
    expect(() => transferArgs({ from: "bad", to: OTHER, amount: 1n })).toThrow(SendError);
  });
  it("balanceArgs: 1 arg address", () => {
    expect(balanceArgs(WALLET)).toHaveLength(1);
  });
});

describe("validateSignedTransfer — whitelist trước khi ví phí trả tiền", () => {
  // Người nhận + số tiền của intent đã duyệt — entry phải khớp ĐÚNG (audit P0-6).
  const base = {
    sacContractId: SAC,
    walletAddress: WALLET,
    expectedRecipient: OTHER,
    expectedAmount: 100n,
  };

  it("entry hợp lệ → trả args + entries", () => {
    const r = validateSignedTransfer({ ...base, entriesXdr: [makeEntry({})] });
    expect(r.entries).toHaveLength(1);
    expect(r.args).toHaveLength(3);
  });

  const rejects: Array<[string, () => string[]]> = [
    [
      "contract lạ",
      () => [
        makeEntry({
          contract:
            OTHER === WALLET ? SAC : "CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP",
        }),
      ],
    ],
    ["method ngoài transfer", () => [makeEntry({ method: "burn" })]],
    [
      "from lệch (ví khác)",
      () => [makeEntry({ args: transferArgs({ from: OTHER, to: WALLET, amount: 1n }) })],
    ],
    [
      "source-account credentials (ví phí tự authorize — cấm)",
      () => [makeEntry({ sourceCredentials: true })],
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
                  contractAddress: new Address(SAC).toScAddress(),
                  functionName: "transfer",
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
  for (const [name, make] of rejects) {
    it(`chối: ${name}`, () => {
      expect(() => validateSignedTransfer({ ...base, entriesXdr: make() })).toThrow(SendError);
    });
  }
});

describe("validateSignedTransfer — buộc entry khớp intent đã duyệt (audit P0-6)", () => {
  const base = {
    sacContractId: SAC,
    walletAddress: WALLET,
    expectedRecipient: OTHER,
    expectedAmount: 100n,
  };
  const THIRD = Keypair.random().publicKey();

  it("đổi NGƯỜI NHẬN sau khi intent đã duyệt → chối", () => {
    const evil = makeEntry({ args: transferArgs({ from: WALLET, to: THIRD, amount: 100n }) });
    expect(() => validateSignedTransfer({ ...base, entriesXdr: [evil] })).toThrow(SendError);
  });

  it("thổi SỐ TIỀN lên sau khi qua cổng chính sách → chối", () => {
    const evil = makeEntry({
      args: transferArgs({ from: WALLET, to: OTHER, amount: 10_000_000_000_000n }),
    });
    expect(() => validateSignedTransfer({ ...base, entriesXdr: [evil] })).toThrow(SendError);
  });

  it("khớp đúng cả hai → cho qua", () => {
    const ok = makeEntry({ args: transferArgs({ from: WALLET, to: OTHER, amount: 100n }) });
    expect(() => validateSignedTransfer({ ...base, entriesXdr: [ok] })).not.toThrow();
  });
});
