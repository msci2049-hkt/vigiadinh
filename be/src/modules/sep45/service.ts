// Service SEP-45 — orchestration challenge/token. Deps TIÊM QUA THAM SỐ (nonce store,
// simulator, ledger) để test hermetic; bản wire thật nằm ở infra.ts + routes.ts.
import { createHash } from "node:crypto";
import type { Keypair } from "@stellar/stellar-sdk";
import {
  assertNonceOnlyFootprint,
  buildChallengeEntries,
  footprintAllowedAddresses,
  Sep45ValidationError,
  validateSignedEntries,
} from "./entries";
import { signWalletJwt } from "./jwt";
import type { ChallengeSimulator, NonceStore, Sep45Config, WalletJwtClaims } from "./types";

export type Sep45Deps = {
  config: Sep45Config;
  signingKey: Keypair;
  jwtSecret: string;
  nonces: NonceStore;
  simulator: ChallengeSimulator;
  /** Ledger hiện tại từ RPC (getLatestLedger). */
  latestLedger(): Promise<number>;
  /**
   * Số hiệu phiên ví hiện tại (`wallets.jwt_version`) — nhúng vào claims để token
   * thu hồi được khi recovery xoay khoá (closeout §4). `null` = không biết ví này.
   */
  walletVersion(walletAddress: string): Promise<number | null>;
  now?: () => number;
};

// Ledger ~5s/close — đổi TTL giây → số ledger, tối thiểu 1 phút đệm.
const LEDGER_SECONDS = 5;

export async function createChallenge(
  deps: Sep45Deps,
  input: { account: string; homeDomain?: string; deviceId?: string },
): Promise<{ authorization_entries: string; network_passphrase: string }> {
  const { config } = deps;
  // home_domain client gửi (nếu có) phải đúng domain ta phục vụ — spec cho phép
  // server nhiều home_domain, ta chỉ có một.
  if (input.homeDomain && input.homeDomain !== config.homeDomain) {
    throw new Sep45ValidationError("HOME_DOMAIN_NOT_SERVED");
  }
  const nonce = createHash("sha256")
    .update(crypto.getRandomValues(new Uint8Array(32)))
    .digest("hex")
    .slice(0, 32);

  const stored = await deps.nonces.put(
    nonce,
    JSON.stringify({ account: input.account, device: input.deviceId ?? null }),
    config.challengeTtlSeconds,
  );
  if (!stored) throw new Sep45ValidationError("NONCE_COLLISION");

  const validUntilLedger =
    (await deps.latestLedger()) + Math.ceil(config.challengeTtlSeconds / LEDGER_SECONDS);

  const entries = await buildChallengeEntries(
    config,
    deps.signingKey,
    {
      account: input.account,
      home_domain: config.homeDomain,
      web_auth_domain: config.webAuthDomain,
      web_auth_domain_account: config.serverAccount,
      nonce,
    },
    validUntilLedger,
  );
  return { authorization_entries: entries, network_passphrase: config.networkPassphrase };
}

export async function verifyChallengeAndIssueJwt(
  deps: Sep45Deps,
  input: { entriesXdrBase64: string },
): Promise<{ token: string }> {
  const { config } = deps;
  const validated = validateSignedEntries(config, input.entriesXdrBase64);

  // Nonce single-use: GETDEL — thua race thì request thứ hai chết ở đây (chống replay
  // + chống phát 2 JWT cho 1 challenge, đúng spec).
  const payload = await deps.nonces.consume(validated.nonce);
  if (payload === null) throw new Sep45ValidationError("NONCE_UNKNOWN_OR_USED");
  const bound = JSON.parse(payload) as { account: string; device: string | null };
  if (bound.account !== validated.account) throw new Sep45ValidationError("ACCOUNT_MISMATCH");

  // Chữ ký (server + __check_auth của ví) verify bằng SIMULATE — theo spec.
  const sim = await deps.simulator.simulate(input.entriesXdrBase64, validated.args);
  if (!sim.ok) throw new Sep45ValidationError(`SIMULATION_FAILED:${sim.error}`);

  // Cổng CƠ CHẾ (closeout §4): simulate THÀNH CÔNG chưa đủ — một entry `transfer`
  // lọt qua các check cấu trúc cũng simulate thành công, và lúc đó ta đang ký hộ
  // lệnh rút tiền trong khi màn hình người dùng chỉ nói "đăng nhập bằng passkey".
  // Footprint GHI là thứ host báo cáo, không phải thứ ta đoán: chỉ cho phép đúng
  // các entry nonce của những địa chỉ spec liệt kê, mọi thứ khác chối.
  assertNonceOnlyFootprint(sim.readWrite, footprintAllowedAddresses(config, validated.args));

  // Số hiệu phiên PHẢI có mặt trong claims, nếu không token vừa phát đã không thu
  // hồi được. Ví không có trong DB → chối luôn: không có mốc nào để so sau này, mà
  // phát một token vĩnh viễn-không-thu-hồi thì tệ hơn là bắt người dùng thử lại.
  const version = await deps.walletVersion(validated.account);
  if (version === null) throw new Sep45ValidationError("WALLET_UNKNOWN");

  const now = deps.now ? deps.now() : Math.floor(Date.now() / 1000);
  const claims: WalletJwtClaims = {
    iss: config.webAuthDomain,
    sub: validated.account,
    iat: now,
    exp: now + config.jwtTtlSeconds,
    jti: createHash("sha256").update(validated.nonce).digest("hex"),
    home_domain: config.homeDomain,
    ver: version,
    ...(bound.device ? { device: bound.device } : {}),
  };
  return { token: signWalletJwt(deps.jwtSecret, claims) };
}
