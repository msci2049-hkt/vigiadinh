// D3 — VÍ CŨ bật trần cứng on-chain ("Bật khoá chi tiêu" ở Cài đặt → An toàn).
//
// GET  /:id/onchain-policy         — rule 0 đã chở policy chưa (đọc THẲNG chain)
// POST /:id/onchain-policy/prepare — build tx `add_policy(rule 0, policy, params)`
// POST /:id/onchain-policy/submit  — nhận entry ĐÃ KÝ passkey → validate NGUYÊN
//                                    VĂN → ví phí ký envelope + nộp (chuỗi
//                                    hai-nửa như send: BE build, FE ký, BE nộp)
//
// Ví MỚI không đi đường này — policy gắn ngay trong constructor lúc deploy (D1).
import { xdr } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import {
  assertSponsorshipAllowed,
  FEE_CAP_STROOPS,
  FeePolicyError,
} from "@/services/stellar/fee-policy";
import {
  buildInvokeTx,
  invokeWithSignedEntries,
  StellarServiceError,
  simulateRead,
} from "@/services/stellar/stellar.service";
import { walletIdParam } from "../../domain/validators";
import * as walletRepo from "../../infra/wallets.repository";
import {
  addPolicyArgs,
  OnchainPolicyError,
  OWNER_RULE_ID,
  validateSignedAddPolicy,
} from "./domain";

const writeLimit = rateLimit({
  points: 5,
  duration: 60,
  keyPrefix: "wallet-onchain-policy",
  failOpen: false,
});

const submitBody = z.object({
  signed_entries: z.array(z.string().min(1)).min(1).max(2),
});

/** Thiếu cấu hình → 503 (app sống, module khác chạy — khuôn get-balance). */
function requiredEnv(): { policy: string; sac: string; registry: string } {
  if (!env.CONTRACT_ID_SPENDING_LIMIT_POLICY || !env.CONTRACT_ID_SAC_NATIVE) {
    throw new HTTPException(503, { message: "ONCHAIN_POLICY_NOT_CONFIGURED" });
  }
  if (!env.CONTRACT_ID_RECOVERY) {
    // Cổng ví phí cần registry (B-SEC-3) — thiếu là fail-closed, không bỏ cổng.
    throw new HTTPException(503, { message: "SPONSORSHIP_CHECK_UNAVAILABLE" });
  }
  return {
    policy: env.CONTRACT_ID_SPENDING_LIMIT_POLICY,
    sac: env.CONTRACT_ID_SAC_NATIVE,
    registry: env.CONTRACT_ID_RECOVERY,
  };
}

async function requireOwnedWallet(userId: string, walletId: string) {
  const wallet = await walletRepo.findByIdForUser(walletId, userId);
  if (!wallet) throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });
  return wallet;
}

function requireUser(c: { get(k: "user"): { id: string } | null }): { id: string } {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  return user;
}

function mapChainError(err: unknown): never {
  if (err instanceof OnchainPolicyError) {
    throw new HTTPException(400, { message: err.message });
  }
  if (err instanceof FeePolicyError) {
    throw new HTTPException(403, { message: err.message });
  }
  if (err instanceof StellarServiceError) {
    logger.error({ err: err.message }, "wallet.onchain-policy.chain-error");
    throw new HTTPException(502, { message: `STELLAR_UNAVAILABLE:${err.message.slice(0, 200)}` });
  }
  throw err;
}

export const onchainPolicyRoute = new Hono()
  .get("/:id/onchain-policy", requireAuth, zv("param", walletIdParam), async (c) => {
    const user = requireUser(c);
    const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id);
    const { policy } = requiredEnv();
    // Đọc THẲNG chain (khuôn recovery-config): mirror DB không có tiếng nói ở
    // câu hỏi "trần cứng có thật không".
    try {
      const rule = (await simulateRead({
        contractId: wallet.stellarAddress,
        method: "get_context_rule",
        args: [xdr.ScVal.scvU32(OWNER_RULE_ID)],
      })) as { policies?: unknown[] } | null;
      const policies = Array.isArray(rule?.policies) ? rule.policies.map(String) : [];
      return c.json({
        data: { attached: policies.includes(policy), policyContractId: policy },
      });
    } catch (err) {
      if (err instanceof StellarServiceError) {
        // Ví chưa lên chain / RPC lỗi — nói "không biết", đừng đoán.
        return c.json({ data: { attached: null, policyContractId: policy } });
      }
      throw err;
    }
  })
  .post(
    "/:id/onchain-policy/prepare",
    requireAuth,
    writeLimit,
    zv("param", walletIdParam),
    async (c) => {
      const user = requireUser(c);
      const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id);
      const { policy, sac } = requiredEnv();
      try {
        const built = await buildInvokeTx({
          contractId: wallet.stellarAddress,
          method: "add_policy",
          args: addPolicyArgs(policy, sac),
        });
        return c.json({ data: built });
      } catch (err) {
        mapChainError(err);
      }
    },
  )
  .post(
    "/:id/onchain-policy/submit",
    requireAuth,
    writeLimit,
    zv("param", walletIdParam),
    zv("json", submitBody),
    async (c) => {
      const user = requireUser(c);
      const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id);
      const { policy, sac, registry } = requiredEnv();
      const body = c.req.valid("json");
      try {
        const validated = validateSignedAddPolicy({
          walletAddress: wallet.stellarAddress,
          policyContractId: policy,
          sacContractId: sac,
          entriesXdr: body.signed_entries,
        });
        // Cổng ví phí (B-SEC-3): chỉ ví ĐÃ đăng ký registry được trả hộ.
        await assertSponsorshipAllowed({
          read: simulateRead,
          registryContractId: registry,
          walletAddress: wallet.stellarAddress,
          method: "add_policy",
        });
        const result = await invokeWithSignedEntries({
          contractId: wallet.stellarAddress,
          method: "add_policy",
          args: validated.args,
          authEntries: validated.entries,
          maxFeeStroops: FEE_CAP_STROOPS,
        });
        // Xác nhận từ CHAIN — không tin status submit suông.
        const rule = (await simulateRead({
          contractId: wallet.stellarAddress,
          method: "get_context_rule",
          args: [xdr.ScVal.scvU32(OWNER_RULE_ID)],
        })) as { policies?: unknown[] } | null;
        const attached = Array.isArray(rule?.policies)
          ? rule.policies.map(String).includes(policy)
          : false;
        return c.json({ data: { hash: result.hash, status: result.status, attached } });
      } catch (err) {
        mapChainError(err);
      }
    },
  );
