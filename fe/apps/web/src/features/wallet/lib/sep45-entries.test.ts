// Test XDR thuần — dựng 2 entry như BE trả về (server + client), kiểm decode/encode
// roundtrip, tìm đúng entry của ví, giữ đúng expiration ledger.
import { Address, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  decodeEntriesXdr,
  encodeEntriesXdr,
  entryExpirationLedger,
  findEntryIndexForAccount,
} from "./sep45-entries";

// tsconfig.app không có node types (code src chạy browser) — StrKey của SDK khai
// tham số Buffer nhưng runtime nhận Uint8Array; lấy type từ chữ ký hàm, không gọi tên Buffer.
type StrKeyBytes = Parameters<typeof StrKey.encodeContract>[0];
const bytes32 = (fill: number) => new Uint8Array(32).fill(fill) as unknown as StrKeyBytes;

const SERVER_G = StrKey.encodeEd25519PublicKey(bytes32(1));
const WALLET_C = StrKey.encodeContract(bytes32(9));
const CONTRACT = StrKey.encodeContract(bytes32(7));

function makeEntry(address: string, expiration: number): xdr.SorobanAuthorizationEntry {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(CONTRACT).toScAddress(),
        functionName: "web_auth_verify",
        args: [xdr.ScVal.scvString("stub")],
      }),
    ),
    subInvocations: [],
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: new xdr.Int64(7n),
        signatureExpirationLedger: expiration,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: invocation,
  });
}

describe("sep45-entries", () => {
  const entries = [makeEntry(SERVER_G, 12345), makeEntry(WALLET_C, 12345)];

  it("encode → decode roundtrip giữ nguyên từng entry", () => {
    const decoded = decodeEntriesXdr(encodeEntriesXdr(entries));
    expect(decoded).toHaveLength(2);
    expect(decoded[0]?.toXDR("base64")).toBe(entries[0]?.toXDR("base64"));
    expect(decoded[1]?.toXDR("base64")).toBe(entries[1]?.toXDR("base64"));
  });

  it("tìm đúng entry của ví (bỏ qua entry server)", () => {
    expect(findEntryIndexForAccount(entries, WALLET_C)).toBe(1);
    expect(findEntryIndexForAccount(entries, SERVER_G)).toBe(0);
    expect(findEntryIndexForAccount(entries, StrKey.encodeContract(bytes32(3)))).toBe(-1);
  });

  it("đọc đúng signatureExpirationLedger BE đã đặt", () => {
    const entry = entries[1];
    if (!entry) throw new Error("thiếu entry");
    expect(entryExpirationLedger(entry)).toBe(12345);
  });
});
