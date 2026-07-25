// Test hermetic (không network/redis): build challenge → validate roundtrip + các ca
// tamper phải chết đúng mã. Server keypair SINH NGẪU NHIÊN mỗi lần chạy (cấm S... literal).
import { describe, expect, it } from "bun:test";
import { Address, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import {
  assertNonceOnlyFootprint,
  buildChallengeEntries,
  decodeEntriesXdr,
  encodeEntriesXdr,
  footprintAllowedAddresses,
  Sep45ValidationError,
  validateSignedEntries,
} from "./entries";
import type { ChallengeArgs, Sep45Config } from "./types";

const signingKey = Keypair.random();
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));
const ACCOUNT = StrKey.encodeContract(Buffer.alloc(32, 9));

const config: Sep45Config = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  webAuthContractId: CONTRACT_ID,
  serverAccount: signingKey.publicKey(),
  homeDomain: "localhost:5173",
  webAuthDomain: "localhost:3000",
  challengeTtlSeconds: 300,
  jwtTtlSeconds: 86400,
};

const baseArgs: ChallengeArgs = {
  account: ACCOUNT,
  home_domain: config.homeDomain,
  web_auth_domain: config.webAuthDomain,
  web_auth_domain_account: config.serverAccount,
  nonce: "a".repeat(32),
};

async function freshChallenge(args: ChallengeArgs = baseArgs): Promise<string> {
  return buildChallengeEntries(config, signingKey, args, 12345);
}

describe("sep45 entries", () => {
  it("build → decode: 2 entry, server ký trước, client chưa ký", async () => {
    const entries = decodeEntriesXdr(await freshChallenge());
    expect(entries).toHaveLength(2);
    // Entry server có chữ ký (scvVec 1 phần tử); entry client là scvVoid (chưa ký).
    expect(entries[0]?.credentials().address().signature().vec()?.length).toBe(1);
    expect(entries[1]?.credentials().address().signature().switch().name).toBe("scvVoid");
  });

  it("validate chấp nhận challenge nguyên vẹn (chưa cần chữ ký client — simulate lo)", async () => {
    const validated = validateSignedEntries(config, await freshChallenge());
    expect(validated.account).toBe(ACCOUNT);
    expect(validated.nonce).toBe(baseArgs.nonce);
  });

  it("từ chối XDR rác", () => {
    expect(() => validateSignedEntries(config, "bm90LXhkcg==")).toThrow(Sep45ValidationError);
  });

  it("từ chối challenge trỏ contract khác", async () => {
    const evil = { ...config, webAuthContractId: StrKey.encodeContract(Buffer.alloc(32, 8)) };
    const challenge = await freshChallenge();
    expect(() => validateSignedEntries(evil, challenge)).toThrow("WRONG_CONTRACT");
  });

  it("từ chối home_domain lạ (phishing domain khác xin challenge)", async () => {
    const challenge = await buildChallengeEntries(
      config,
      signingKey,
      { ...baseArgs, home_domain: "evil.example.com" },
      12345,
    );
    expect(() => validateSignedEntries(config, challenge)).toThrow("HOME_DOMAIN_MISMATCH");
  });

  it("từ chối web_auth_domain_account không phải server key", async () => {
    const challenge = await buildChallengeEntries(
      config,
      signingKey,
      { ...baseArgs, web_auth_domain_account: Keypair.random().publicKey() },
      12345,
    );
    expect(() => validateSignedEntries(config, challenge)).toThrow("SERVER_ACCOUNT_MISMATCH");
  });

  it("từ chối nonce lệch giữa hai entry (cắt-ghép 2 challenge)", async () => {
    const a = decodeEntriesXdr(await freshChallenge());
    const b = decodeEntriesXdr(await freshChallenge({ ...baseArgs, nonce: "b".repeat(32) }));
    const serverA = a[0];
    const clientB = b[1];
    if (!serverA || !clientB) throw new Error("thiếu entry");
    const spliced = encodeEntriesXdr([serverA, clientB]);
    expect(() => validateSignedEntries(config, spliced)).toThrow("ARGS_MISMATCH_ACROSS_ENTRIES");
  });

  it("từ chối khi thiếu entry của server (client tự chế 2 entry của mình)", async () => {
    const entries = decodeEntriesXdr(await freshChallenge());
    const client = entries[1];
    if (!client) throw new Error("thiếu entry");
    const withoutServer = encodeEntriesXdr([client, client]);
    expect(() => validateSignedEntries(config, withoutServer)).toThrow("SERVER_ENTRY_MISSING");
  });

  it("từ chối account không phải ví contract (G... không đi cửa SEP-45)", async () => {
    const gAccount = Keypair.random().publicKey();
    const challenge = await buildChallengeEntries(
      config,
      signingKey,
      { ...baseArgs, account: gAccount },
      12345,
    );
    expect(() => validateSignedEntries(config, challenge)).toThrow("ACCOUNT_NOT_CONTRACT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Closeout §4 — FOOTPRINT. Mục này bỏ trống ba phiên liền; đây là chỗ đóng.
//
// Vì sao nó mạnh hơn mọi check ở trên: các check kia chặn theo DANH SÁCH thứ ta
// nghĩ ra (sai contract, sai hàm, có subInvocation…). Footprint chặn theo thứ
// Soroban BÁO CÁO là sẽ bị GHI. Một `transfer` lọt qua mọi check cấu trúc vẫn
// phải ghi vào balance, và ghi balance thì không phải nonce → chết ở đây.
describe("assertNonceOnlyFootprint — cổng cơ chế chống ký thuê", () => {
  const CLIENT_DOMAIN_ACCOUNT = Keypair.random().publicKey();

  /** LedgerKey contract_data với key là ledger_key_nonce — dạng entry HỢP LỆ duy nhất. */
  const nonceKey = (owner: string): xdr.LedgerKey =>
    xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(owner).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyNonce(new xdr.ScNonceKey({ nonce: new xdr.Int64(42n) })),
        durability: xdr.ContractDataDurability.temporary(),
      }),
    );

  /** Cái mà một lệnh `transfer` để lại: contract_data key kiểu vec (Balance, addr). */
  const balanceKey = (owner: string): xdr.LedgerKey =>
    xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(owner).toScAddress(),
        key: xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("Balance"),
          xdr.ScVal.scvAddress(new Address(ACCOUNT).toScAddress()),
        ]),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );

  const allowed = footprintAllowedAddresses(config, baseArgs);

  it("footprint rỗng → qua (challenge không bắt buộc ghi gì)", () => {
    expect(() => assertNonceOnlyFootprint([], allowed)).not.toThrow();
  });

  it("chỉ nonce của client + server → qua", () => {
    expect(() =>
      assertNonceOnlyFootprint([nonceKey(ACCOUNT), nonceKey(config.serverAccount)], allowed),
    ).not.toThrow();
  });

  it("ĐÒN CHÍNH: entry ghi balance (transfer) → FOOTPRINT_NOT_NONCE", () => {
    // Đây là biến thể tệ nhất của ký mù: người dùng thấy "đăng nhập bằng passkey",
    // thực tế đang ký lệnh rút sạch ví. Chặn bằng CƠ CHẾ, không bằng so địa chỉ.
    expect(() =>
      assertNonceOnlyFootprint([nonceKey(ACCOUNT), balanceKey(CONTRACT_ID)], allowed),
    ).toThrow("FOOTPRINT_NOT_NONCE");
  });

  it("nonce của địa chỉ LẠ (không phải client/server/client_domain) → FOOTPRINT_UNEXPECTED_ADDRESS", () => {
    const stranger = StrKey.encodeContract(Buffer.alloc(32, 3));
    expect(() => assertNonceOnlyFootprint([nonceKey(stranger)], allowed)).toThrow(
      "FOOTPRINT_UNEXPECTED_ADDRESS",
    );
  });

  it("ledger entry KHÔNG phải contract_data (vd trustline) → FOOTPRINT_NOT_CONTRACT_DATA", () => {
    const trustline = xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.random().xdrAccountId(),
        asset: xdr.TrustLineAsset.assetTypeNative(),
      }),
    );
    expect(() => assertNonceOnlyFootprint([trustline], allowed)).toThrow(
      "FOOTPRINT_NOT_CONTRACT_DATA",
    );
  });

  it("client_domain_account được phép KHI VÀ CHỈ KHI args khai nó", () => {
    const withDomain: ChallengeArgs = {
      ...baseArgs,
      client_domain: "wallet.example",
      client_domain_account: CLIENT_DOMAIN_ACCOUNT,
    };
    // Có khai → nonce của nó hợp lệ.
    expect(() =>
      assertNonceOnlyFootprint(
        [nonceKey(CLIENT_DOMAIN_ACCOUNT)],
        footprintAllowedAddresses(config, withDomain),
      ),
    ).not.toThrow();
    // Không khai → chính địa chỉ đó thành người lạ.
    expect(() => assertNonceOnlyFootprint([nonceKey(CLIENT_DOMAIN_ACCOUNT)], allowed)).toThrow(
      "FOOTPRINT_UNEXPECTED_ADDRESS",
    );
  });

  it("lỗi footprint là Sep45ValidationError → route map 400, không 500", () => {
    expect(() => assertNonceOnlyFootprint([balanceKey(CONTRACT_ID)], allowed)).toThrow(
      Sep45ValidationError,
    );
  });
});

// SEP-45 loại credential DELEGATED. SDK v16 biết cả `addressV2` (CAP-71) lẫn
// `addressWithDelegates` — với chúng, người ký thật KHÁC địa chỉ ghi trong entry,
// nên mọi so-địa-chỉ ở validateSignedEntries mất nghĩa.
describe("credential delegated bị chối ở cửa challenge", () => {
  it("addressWithDelegates → DELEGATED_CREDENTIALS_FORBIDDEN", async () => {
    const entries = decodeEntriesXdr(await freshChallenge());
    const [server, client] = entries;
    if (!server || !client) throw new Error("thiếu entry");
    const delegated = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
        new xdr.SorobanAddressCredentialsWithDelegates({
          // Bọc đúng SorobanAddressCredentials rồi kèm danh sách delegate — người
          // ký thật khi đó là delegate, KHÔNG phải `address` ghi ở trong.
          addressCredentials: new xdr.SorobanAddressCredentials({
            address: new Address(ACCOUNT).toScAddress(),
            nonce: new xdr.Int64(1n),
            signatureExpirationLedger: 12345,
            signature: xdr.ScVal.scvVoid(),
          }),
          delegates: [],
        }),
      ),
      rootInvocation: client.rootInvocation(),
    });
    const tampered = encodeEntriesXdr([server, delegated]);
    expect(() => validateSignedEntries(config, tampered)).toThrow(
      "DELEGATED_CREDENTIALS_FORBIDDEN",
    );
  });
});
