// Test hermetic (không network/redis): build challenge → validate roundtrip + các ca
// tamper phải chết đúng mã. Server keypair SINH NGẪU NHIÊN mỗi lần chạy (cấm S... literal).
import { describe, expect, it } from "bun:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  buildChallengeEntries,
  decodeEntriesXdr,
  encodeEntriesXdr,
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
