// Test tầng ký recovery (PHA 6 cụm GHI) — kit MOCK (đường passkey thật chứng
// minh ở e2e BE audit P0 + e2e CI); ở đây khoá hành vi chọn entry:
// chỉ ký entry CỦA VÍ, entry người khác nguyên vẹn, chối khi ví chưa connect
// hoặc build không có entry nào của ví.
import { Address, StrKey, xdr } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecoverySignError, signRecoveryEntries } from "./sign-recovery-entries";

type StrKeyBytes = Parameters<typeof StrKey.encodeContract>[0];
const bytes32 = (fill: number) => new Uint8Array(32).fill(fill) as unknown as StrKeyBytes;

const WALLET_C = StrKey.encodeContract(bytes32(9));
const GUARDIAN_G = StrKey.encodeEd25519PublicKey(bytes32(2));
const REGISTRY = StrKey.encodeContract(bytes32(7));

const kitMock = {
  contractId: WALLET_C as string | null,
  credentialId: "cred-1" as string | null,
  signAuthEntry: vi.fn(),
};
vi.mock("./kit", () => ({ getWalletKit: () => kitMock }));

function makeEntry(address: string): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: new xdr.Int64(7n),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(REGISTRY).toScAddress(),
          functionName: "cancel_recovery",
          args: [new Address(WALLET_C).toScVal()],
        }),
      ),
      subInvocations: [],
    }),
  });
}

// "Chữ ký" mock: đổi expiration để phân biệt entry đã qua kit.
function fakeSigned(entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAuthorizationEntry {
  const clone = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
  clone.credentials().address().signatureExpirationLedger(99999);
  return clone;
}

beforeEach(() => {
  kitMock.contractId = WALLET_C;
  kitMock.credentialId = "cred-1";
  kitMock.signAuthEntry.mockReset();
  kitMock.signAuthEntry.mockImplementation(async (entry: xdr.SorobanAuthorizationEntry) =>
    fakeSigned(entry),
  );
});

describe("signRecoveryEntries", () => {
  it("ký entry CỦA VÍ, entry người khác giữ NGUYÊN, đúng thứ tự", async () => {
    const walletEntry = makeEntry(WALLET_C).toXDR("base64");
    const guardianEntry = makeEntry(GUARDIAN_G).toXDR("base64");
    const out = await signRecoveryEntries({
      entriesXdr: [guardianEntry, walletEntry],
      latestLedger: 1000,
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(guardianEntry); // nguyên vẹn từng byte
    expect(out[1]).not.toBe(walletEntry);
    const signed = xdr.SorobanAuthorizationEntry.fromXDR(out[1] ?? "", "base64");
    expect(signed.credentials().address().signatureExpirationLedger()).toBe(99999);
    expect(kitMock.signAuthEntry).toHaveBeenCalledTimes(1);
    // Expiration neo theo latestLedger simulation (+120).
    expect(kitMock.signAuthEntry.mock.calls[0]?.[1]).toMatchObject({
      credentialId: "cred-1",
      expiration: 1120,
      // Bắt buộc truyền rule ids: placeholder scvVoid không tự khai được (on-chain
      // sẽ chối nếu digest không bind rule ids — đã chứng minh ở BE e2e).
      contextRuleIds: [0],
    });
  });

  it("ví chưa connect → WALLET_NOT_CONNECTED, kit không bị gọi", async () => {
    kitMock.contractId = null;
    await expect(
      signRecoveryEntries({ entriesXdr: [makeEntry(WALLET_C).toXDR("base64")], latestLedger: 1 }),
    ).rejects.toThrow(RecoverySignError);
    expect(kitMock.signAuthEntry).not.toHaveBeenCalled();
  });

  it("không entry nào của ví → NO_ENTRY_FOR_WALLET (chặn sớm, khỏi chết mã contract khó hiểu)", async () => {
    await expect(
      signRecoveryEntries({ entriesXdr: [makeEntry(GUARDIAN_G).toXDR("base64")], latestLedger: 1 }),
    ).rejects.toThrow("NO_ENTRY_FOR_WALLET");
  });
});
