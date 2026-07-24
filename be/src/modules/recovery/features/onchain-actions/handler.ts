// Route ghi recovery on-chain (PHA 5.2) — mount /api/recovery (routes.ts).
// POST /register|initiate|approve|veto → build+simulate, trả tx + entries cho FE ký.
// POST /submit → nộp entries đã ký, ví phí ký envelope + submit + poll.
// POST /finalize → one-shot (không đòi auth người dùng — timelock on-chain gác).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import {
  buildInvokeTx,
  invokeWithSignedEntries,
  StellarServiceError,
  simulateRead,
} from "@/services/stellar/stellar.service";
import { contractErrorCode, RecoveryOnchainError } from "../../domain/onchain";
import { buildActionBody, finalizeBody, submitBody } from "./dto";
import {
  type BuildableAction,
  buildRecoveryAction,
  finalizeRecovery,
  type OnchainGateway,
  RecoveryActionError,
  submitRecoveryAction,
} from "./service";

const realGateway: OnchainGateway = {
  build: buildInvokeTx,
  invoke: invokeWithSignedEntries,
  read: simulateRead,
};

/** Registry chưa cấu hình → 503 (app sống, module khác chạy — pattern sep45). */
function registryContractId(): string {
  if (!env.CONTRACT_ID_RECOVERY) {
    throw new HTTPException(503, { message: "RECOVERY_ONCHAIN_NOT_CONFIGURED" });
  }
  return env.CONTRACT_ID_RECOVERY;
}

/** Map lỗi domain/chain → HTTP, không leak XDR/stack; chi tiết vào log server. */
function mapError(err: unknown): never {
  if (err instanceof RecoveryActionError) {
    throw new HTTPException(err.status, { message: err.message });
  }
  if (err instanceof RecoveryOnchainError) {
    throw new HTTPException(400, { message: err.message });
  }
  if (err instanceof StellarServiceError) {
    if (err.message === "FEE_WALLET_NOT_CONFIGURED") {
      throw new HTTPException(503, { message: err.message });
    }
    if (err.message.startsWith("SIMULATION_FAILED:")) {
      const code = contractErrorCode(err.message);
      logger.warn({ err: err.message }, "recovery.onchain.simulation-failed");
      throw new HTTPException(409, { message: code ?? "SIMULATION_FAILED" });
    }
    logger.error({ err: err.message }, "recovery.onchain.stellar-error");
    throw new HTTPException(502, { message: "STELLAR_UNAVAILABLE" });
  }
  throw err as Error;
}

function requireUser(c: { get(key: "user"): { id: string } | null }): { id: string } {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  return user;
}

// Ghi on-chain + tốn phí ví hệ thống → limit chặt, failOpen=false (Dragonfly chết
// thì chặn, không thả) — cùng triết lý cửa nhạy cảm sep45.
const writeLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "recovery-onchain",
  failOpen: false,
});

function buildRoute(action: BuildableAction) {
  return new Hono().post(
    `/${action}`,
    requireAuth,
    writeLimit,
    zv("json", buildActionBody),
    async (c) => {
      const user = requireUser(c);
      const body = c.req.valid("json");
      const result = await buildRecoveryAction(realGateway, registryContractId(), {
        action,
        walletId: body.wallet_id,
        userId: user.id,
        ...(body.new_signer_verifier ? { newSignerVerifier: body.new_signer_verifier } : {}),
        ...(body.new_signer_key ? { newSignerKey: body.new_signer_key } : {}),
        ...(body.guardian_address ? { guardianAddress: body.guardian_address } : {}),
      }).catch(mapError);
      return c.json({
        data: {
          action: result.action,
          wallet_id: result.walletId,
          transaction_xdr: result.transactionXdr,
          auth_entries_xdr: result.authEntriesXdr,
          latest_ledger: result.latestLedger,
        },
      });
    },
  );
}

export const onchainActionsRoute = new Hono()
  .route("/", buildRoute("register"))
  .route("/", buildRoute("initiate"))
  .route("/", buildRoute("approve"))
  .route("/", buildRoute("veto"))
  .route("/", buildRoute("addGuardian"))
  .post("/submit", requireAuth, writeLimit, zv("json", submitBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const result = await submitRecoveryAction(realGateway, registryContractId(), {
      walletId: body.wallet_id,
      userId: user.id,
      signedEntriesXdr: body.signed_entries,
    }).catch(mapError);
    return c.json({ data: result });
  })
  .post("/finalize", requireAuth, writeLimit, zv("json", finalizeBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const result = await finalizeRecovery(realGateway, registryContractId(), {
      walletId: body.wallet_id,
      userId: user.id,
    }).catch(mapError);
    return c.json({ data: result });
  });
