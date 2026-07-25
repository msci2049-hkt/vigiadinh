// Test service SEP-45 hermetic — nonce store in-memory + simulator fake. Phủ:
// happy path đủ vòng challenge→token, replay nonce, simulate fail, account tráo.
import { describe, expect, it } from "bun:test";
import { Address, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import { verifyWalletJwtSignatureOnly } from "./jwt";
import { createChallenge, type Sep45Deps, verifyChallengeAndIssueJwt } from "./service";
import type { ChallengeSimulator, NonceStore, Sep45Config } from "./types";

const signingKey = Keypair.random();
const ACCOUNT = StrKey.encodeContract(Buffer.alloc(32, 9));
const JWT_SECRET = crypto.randomUUID() + crypto.randomUUID();

function memoryNonceStore(): NonceStore & { size(): number } {
  const map = new Map<string, string>();
  return {
    async put(nonce, payload) {
      if (map.has(nonce)) return false;
      map.set(nonce, payload);
      return true;
    },
    async consume(nonce) {
      const value = map.get(nonce) ?? null;
      map.delete(nonce);
      return value;
    },
    size: () => map.size,
  };
}

function makeDeps(
  simulator?: ChallengeSimulator,
): Sep45Deps & { nonces: ReturnType<typeof memoryNonceStore> } {
  const config: Sep45Config = {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    webAuthContractId: StrKey.encodeContract(Buffer.alloc(32, 7)),
    serverAccount: signingKey.publicKey(),
    homeDomain: "localhost:5173",
    webAuthDomain: "localhost:3000",
    challengeTtlSeconds: 300,
    jwtTtlSeconds: 3600,
  };
  return {
    config,
    signingKey,
    jwtSecret: JWT_SECRET,
    nonces: memoryNonceStore(),
    // Simulate thành công + footprint RỖNG = ca sạch nhất (không ghi gì).
    simulator: simulator ?? { simulate: async () => ({ ok: true, readWrite: [] }) },
    latestLedger: async () => 1000,
    // Closeout §4: ví trong test luôn ở số hiệu phiên 0 trừ khi ca test đổi.
    walletVersion: async () => 0,
  };
}

describe("sep45 service", () => {
  it("happy path: challenge → token, JWT bind ví + device", async () => {
    const deps = makeDeps();
    const challenge = await createChallenge(deps, { account: ACCOUNT, deviceId: "device-abc-123" });
    expect(challenge.network_passphrase).toBe(deps.config.networkPassphrase);
    expect(deps.nonces.size()).toBe(1);

    // Client "ký" — với simulator fake, entries giữ nguyên là đủ cấu trúc hợp lệ.
    const { token } = await verifyChallengeAndIssueJwt(deps, {
      entriesXdrBase64: challenge.authorization_entries,
    });
    const claims = verifyWalletJwtSignatureOnly(JWT_SECRET, token);
    expect(claims?.sub).toBe(ACCOUNT);
    expect(claims?.device).toBe("device-abc-123");
    expect(claims?.home_domain).toBe("localhost:5173");
  });

  it("nonce single-use: nộp lại cùng challenge → NONCE_UNKNOWN_OR_USED", async () => {
    const deps = makeDeps();
    const challenge = await createChallenge(deps, { account: ACCOUNT });
    await verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries });
    expect(
      verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries }),
    ).rejects.toThrow("NONCE_UNKNOWN_OR_USED");
  });

  it("simulate fail (chữ ký sai / __check_auth chối) → SIMULATION_FAILED, KHÔNG phát JWT", async () => {
    const deps = makeDeps({ simulate: async () => ({ ok: false, error: "auth failed" }) });
    const challenge = await createChallenge(deps, { account: ACCOUNT });
    expect(
      verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries }),
    ).rejects.toThrow("SIMULATION_FAILED:auth failed");
    // Nonce đã bị đốt — kẻ tấn công không được thử lại cùng challenge.
    expect(deps.nonces.size()).toBe(0);
  });

  it("nonce bind ví A mà entries khai ví B → ACCOUNT_MISMATCH (phòng thủ chiều sâu)", async () => {
    const deps = makeDeps();
    const challenge = await createChallenge(deps, { account: ACCOUNT });
    const { validateSignedEntries } = await import("./entries");
    const { nonce } = validateSignedEntries(deps.config, challenge.authorization_entries);
    // Tráo binding trong store sang ví khác — mô phỏng store bị ghi đè/lệch.
    await deps.nonces.consume(nonce);
    await deps.nonces.put(
      nonce,
      JSON.stringify({ account: StrKey.encodeContract(Buffer.alloc(32, 3)), device: null }),
      300,
    );
    expect(
      verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries }),
    ).rejects.toThrow("ACCOUNT_MISMATCH");
  });

  it("home_domain client xin không phải domain ta phục vụ → HOME_DOMAIN_NOT_SERVED", async () => {
    const deps = makeDeps();
    expect(
      createChallenge(deps, { account: ACCOUNT, homeDomain: "evil.example.com" }),
    ).rejects.toThrow("HOME_DOMAIN_NOT_SERVED");
  });
});

// Closeout §4 — cổng footprint phải chặn TRƯỚC KHI phát JWT.
// entries.test.ts đã phủ hàm `assertNonceOnlyFootprint` thuần; ở đây kiểm ĐƯỜNG
// ĐI: simulate thành công + footprint bẩn ⇒ không có token nào ra khỏi service.
describe("sep45 service — footprint gate (closeout §4)", () => {
  /** LedgerKey ghi balance — dấu vết của một lệnh `transfer` lén vào challenge. */
  const balanceKey = (owner: string) =>
    xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(owner).toScAddress(),
        key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Balance")]),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );

  it("simulate THÀNH CÔNG nhưng footprint ghi balance → KHÔNG phát JWT", async () => {
    const deps = makeDeps({
      // Điểm mấu chốt: `ok: true`. Kẻ tấn công dựng được entry mà host chạy trót
      // lọt; nếu service chỉ nhìn `ok` thì đúng lúc này ta ký hộ lệnh rút tiền.
      simulate: async () => ({
        ok: true,
        readWrite: [balanceKey(StrKey.encodeContract(Buffer.alloc(32, 9)))],
      }),
    });
    const challenge = await createChallenge(deps, { account: ACCOUNT });
    expect(
      verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries }),
    ).rejects.toThrow("FOOTPRINT_NOT_NONCE");
  });

  it("không đọc được footprint → chối, KHÔNG coi là rỗng", async () => {
    const deps = makeDeps({ simulate: async () => ({ ok: false, error: "NO_TRANSACTION_DATA" }) });
    const challenge = await createChallenge(deps, { account: ACCOUNT });
    expect(
      verifyChallengeAndIssueJwt(deps, { entriesXdrBase64: challenge.authorization_entries }),
    ).rejects.toThrow("SIMULATION_FAILED:NO_TRANSACTION_DATA");
  });
});
