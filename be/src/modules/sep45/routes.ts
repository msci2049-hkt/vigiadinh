// Route SEP-45: GET /challenge + POST /token (mount /api/sep45 — app.ts).
// PUBLIC có chủ đích: đây CHÍNH là cửa đăng nhập bằng ví — chưa có session nào trước đó.
// Bảo vệ bằng rate-limit (failOpen=false như /api/auth/*) + Zod + nonce single-use.
import { Keypair } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { challengeQuery, tokenBody } from "./dto";
import { Sep45ValidationError } from "./entries";
import { redisNonceStore, rpcLatestLedger, rpcSimulator, walletJwtVersion } from "./infra";
import { createChallenge, type Sep45Deps, verifyChallengeAndIssueJwt } from "./service";
import type { Sep45Config } from "./types";

function resolveDeps(): Sep45Deps {
  // Optional env: thiếu → 503 để phần còn lại của app sống bình thường (dev chưa
  // deploy contract vẫn chạy được các module khác).
  if (!env.SEP45_WEB_AUTH_CONTRACT_ID || !env.SEP45_SIGNING_KEY) {
    throw new HTTPException(503, { message: "SEP45_NOT_CONFIGURED" });
  }
  const signingKey = Keypair.fromSecret(env.SEP45_SIGNING_KEY);
  const config: Sep45Config = {
    rpcUrl: env.STELLAR_RPC_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    webAuthContractId: env.SEP45_WEB_AUTH_CONTRACT_ID,
    serverAccount: signingKey.publicKey(),
    homeDomain: env.SEP45_HOME_DOMAIN,
    webAuthDomain: env.SEP45_WEB_AUTH_DOMAIN,
    challengeTtlSeconds: env.SEP45_CHALLENGE_TTL_SECONDS,
    jwtTtlSeconds: env.SEP45_JWT_TTL_SECONDS,
  };
  return {
    config,
    signingKey,
    jwtSecret: env.BETTER_AUTH_SECRET,
    nonces: redisNonceStore,
    simulator: rpcSimulator(config),
    latestLedger: rpcLatestLedger(config),
    walletVersion: walletJwtVersion,
  };
}

/** Sep45ValidationError → 400 mã lỗi gọn (không leak chi tiết XDR/stack). */
function mapDomainError(err: unknown): never {
  if (err instanceof Sep45ValidationError) {
    throw new HTTPException(400, { message: err.message });
  }
  throw err as Error;
}

export const sep45Routes = new Hono()
  .get(
    "/challenge",
    rateLimit({ points: 10, duration: 60, keyPrefix: "sep45-challenge", failOpen: false }),
    zv("query", challengeQuery),
    async (c) => {
      const q = c.req.valid("query");
      // client_domain là tính năng optional của spec — ta KHÔNG hỗ trợ, từ chối rõ.
      if (q.client_domain) throw new HTTPException(400, { message: "CLIENT_DOMAIN_UNSUPPORTED" });
      const deps = resolveDeps();
      const result = await createChallenge(deps, {
        account: q.account,
        homeDomain: q.home_domain,
        deviceId: q.device_id,
      }).catch(mapDomainError);
      return c.json(result);
    },
  )
  .post(
    "/token",
    rateLimit({ points: 10, duration: 60, keyPrefix: "sep45-token", failOpen: false }),
    zv("json", tokenBody),
    async (c) => {
      const body = c.req.valid("json");
      const deps = resolveDeps();
      const result = await verifyChallengeAndIssueJwt(deps, {
        entriesXdrBase64: body.authorization_entries,
      }).catch(mapDomainError);
      return c.json(result);
    },
  );
