// Route gửi tiền (PHA 6 SEND) — mount /api/intents/send.
// POST /prepare  → tạo draft + kiểm số dư (chặn TRƯỚC biometric) → review
// POST /confirm  → policy → build tx transfer (allow) HOẶC awaiting_guardian
// GET  /signable → owner lấy tx ký khi intent awaiting_signature (đường guardian)
// POST /sign     → nộp entry đã ký → submit + poll → settled
// POST /guardian-approve → guardian duyệt intent vượt ngưỡng (off-chain, K5)
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
import { SendError } from "../../domain/transfer";
import { confirmSendBody, guardianApproveBody, prepareSendBody, signSendBody } from "./dto";
import {
  confirmSend,
  getSignable,
  guardianApproveIntent,
  prepareSend,
  type SendGateway,
  SendServiceError,
  signAndSubmit,
} from "./service";

const gateway: SendGateway = {
  build: buildInvokeTx,
  invoke: invokeWithSignedEntries,
  read: simulateRead,
};

/** SAC native chưa cấu hình → 503 (app sống, module khác chạy — pattern recovery). */
function sacContractId(): string {
  if (!env.CONTRACT_ID_SAC_NATIVE) {
    throw new HTTPException(503, { message: "SEND_NOT_CONFIGURED" });
  }
  return env.CONTRACT_ID_SAC_NATIVE;
}

function requireUser(c: { get(k: "user"): { id: string } | null }): { id: string } {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  return user;
}

/** Map lỗi domain/chain → HTTP; chi tiết an toàn (shortfall) đi kèm, không leak XDR. */
function mapError(err: unknown): never {
  if (err instanceof SendServiceError) {
    throw new HTTPException(err.status, {
      message: err.detail ? `${err.message}:${JSON.stringify(err.detail)}` : err.message,
    });
  }
  if (err instanceof SendError) {
    throw new HTTPException(400, { message: err.message });
  }
  if (err instanceof Error && err.message.startsWith("INVALID_TRANSITION")) {
    throw new HTTPException(409, { message: err.message });
  }
  if (err instanceof Error && err.message === "APPROVAL_BINDING_MISMATCH") {
    throw new HTTPException(409, { message: err.message });
  }
  if (err instanceof StellarServiceError) {
    if (err.message === "FEE_WALLET_NOT_CONFIGURED") {
      throw new HTTPException(503, { message: err.message });
    }
    logger.warn({ err: err.message }, "send.stellar-error");
    throw new HTTPException(502, { message: "STELLAR_UNAVAILABLE" });
  }
  throw err as Error;
}

// Gửi tiền + tốn phí ví hệ thống → limit chặt, failOpen=false (như recovery).
const writeLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "send",
  failOpen: false,
});

export const sendFlowRoute = new Hono()
  .post("/send/prepare", requireAuth, writeLimit, zv("json", prepareSendBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const result = await prepareSend(gateway, sacContractId(), {
      walletId: body.wallet_id,
      userId: user.id,
      clientIntentId: body.client_intent_id,
      recipient: body.recipient,
      amount: BigInt(body.amount),
    }).catch(mapError);
    return c.json({ data: result });
  })
  .post("/send/confirm", requireAuth, writeLimit, zv("json", confirmSendBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const result = await confirmSend(gateway, sacContractId(), {
      intentId: body.intent_id,
      userId: user.id,
    }).catch(mapError);
    return c.json({ data: result });
  })
  .get("/send/:intentId/signable", requireAuth, async (c) => {
    const user = requireUser(c);
    const result = await getSignable(gateway, sacContractId(), {
      intentId: c.req.param("intentId"),
      userId: user.id,
    }).catch(mapError);
    return c.json({ data: result });
  })
  .post("/send/sign", requireAuth, writeLimit, zv("json", signSendBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const result = await signAndSubmit(gateway, sacContractId(), {
      intentId: body.intent_id,
      userId: user.id,
      signedEntriesXdr: body.signed_entries,
    }).catch(mapError);
    return c.json({ data: result });
  })
  .post(
    "/send/guardian-approve",
    requireAuth,
    writeLimit,
    zv("json", guardianApproveBody),
    async (c) => {
      const user = requireUser(c);
      const body = c.req.valid("json");
      const result = await guardianApproveIntent({
        intentId: body.intent_id,
        userId: user.id,
        verifiedCall: body.verified_call,
      }).catch(mapError);
      return c.json({ data: result });
    },
  );
