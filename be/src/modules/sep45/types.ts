// Types cho SEP-45 (web auth cho ví contract) — spec: stellar-protocol ecosystem/sep-0045.md.
// Xem RESEARCH-LOG.md (root) mục "PHA 2.3 · SEP-45".
import type { xdr } from "@stellar/stellar-sdk";

/** Cấu hình đã resolve từ env — route dựng một lần mỗi request (throw 503 nếu thiếu). */
export type Sep45Config = {
  rpcUrl: string;
  networkPassphrase: string;
  /** Contract web_auth_verify (contracts/web-auth) đã deploy. */
  webAuthContractId: string;
  /** Public key (G...) của SEP45_SIGNING_KEY. */
  serverAccount: string;
  homeDomain: string;
  webAuthDomain: string;
  challengeTtlSeconds: number;
  jwtTtlSeconds: number;
};

/** Args map trong invocation web_auth_verify — Symbol→String theo spec. */
export type ChallengeArgs = {
  account: string;
  home_domain: string;
  web_auth_domain: string;
  web_auth_domain_account: string;
  nonce: string;
  client_domain?: string;
  client_domain_account?: string;
};

/** Kết quả validate cấu trúc entries đã ký (TRƯỚC bước simulate). */
export type ValidatedChallenge = {
  args: ChallengeArgs;
  /** Địa chỉ ví contract (C...) — args.account. */
  account: string;
  nonce: string;
};

/** Claims JWT phiên ví — sub = địa chỉ ví (C...), KHÔNG phải user id (checklist 2.3). */
export type WalletJwtClaims = {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  /** Chống phát 2 JWT cho 1 challenge — hash nonce. */
  jti: string;
  home_domain: string;
  /** Bind thiết bị (P1-9/checklist): device_id client khai lúc xin challenge. */
  device?: string;
  /**
   * SỐ HIỆU PHIÊN VÍ lúc phát (`wallets.jwt_version`) — closeout §4. Recovery hoàn
   * tất thì cột kia tăng, `ver` này thành cũ, token chết ngay dù `exp` còn xa.
   * Optional trong type vì token phát TRƯỚC bản này không có nó — và thiếu là bị
   * chối, xem `verifyWalletJwtCurrent`.
   */
  ver?: number;
};

/** Nonce store — Redis SET NX EX thật; test tiêm bản in-memory. */
export type NonceStore = {
  /** Lưu nonce mới. False = nonce đã tồn tại (không bao giờ xảy ra với nonce random). */
  put(nonce: string, payload: string, ttlSeconds: number): Promise<boolean>;
  /** Lấy VÀ XOÁ (single-use). Null = không có / đã dùng / hết hạn. */
  consume(nonce: string): Promise<string | null>;
};

/** Cổng simulate — bọc rpc.Server để test tiêm fake (không network). */
/**
 * Kết quả simulate. `readWrite` là footprint GHI mà host báo cáo — bằng chứng duy
 * nhất, do chính Soroban tính, về việc giao dịch này sẽ đụng vào state nào. Service
 * bắt buộc kiểm nó (closeout §4): nếu chỉ trả `error` thì một entry `transfer` lọt
 * qua các check cấu trúc sẽ simulate THÀNH CÔNG và ta ký cho nó.
 */
export type SimulationResult =
  | { ok: false; error: string }
  | { ok: true; readWrite: readonly xdr.LedgerKey[] };

export type ChallengeSimulator = {
  simulate(entriesXdrBase64: string, args: ChallengeArgs): Promise<SimulationResult>;
};
