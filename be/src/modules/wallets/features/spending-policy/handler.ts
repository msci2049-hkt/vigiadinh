// Ngưỡng mềm chi tiêu tự cài (lô policy 2026-07-29 — A6, B1-B5, B8).
//
// GET    /:id/policy          — bản active + pending + trần cứng on-chain
// PUT    /:id/policy          — HẠ → áp NGAY · NÂNG → pending 24h (chống hack
//                               nâng-ngưỡng-rồi-rút: chính sách CŨ hiệu lực
//                               suốt cửa sổ chờ, email báo chủ ví + guardian)
// DELETE /:id/policy/pending  — huỷ đề nghị nâng bất kỳ lúc nào trong 24h
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertWalletScope, type WalletScopedSession } from "@/lib/wallet-scope";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import {
  assertValidLimits,
  ONCHAIN_CAP_STROOPS,
  PolicyValidationError,
} from "../../domain/spending-policy";
import { walletIdParam } from "../../domain/validators";
import * as policyRepo from "../../infra/wallet-policies.repository";
import * as walletRepo from "../../infra/wallets.repository";
import { policyView, putPolicyBody } from "./dto";
import { appendPolicyAudit, notifyRaiseCancelled, notifyRaiseRequested } from "./notify";

const writeLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "wallet-policy",
  failOpen: false,
});

/** Ownership từ DB, không từ claim — ví không thuộc người gọi → 404 (không xác
 * nhận ví tồn tại; khuôn get-balance). Scope: session passkey chỉ được đổi
 * chính sách của ĐÚNG ví đã ký — hạ hạn mức ví B bằng chìa ví A là grief
 * (lib/wallet-scope, lô passkey-là-chìa-khoá 29/07). */
async function requireOwnedWallet(userId: string, walletId: string, session: WalletScopedSession) {
  assertWalletScope(session, walletId);
  const wallet = await walletRepo.findByIdForUser(walletId, userId);
  if (!wallet) throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });
  return wallet;
}

export const spendingPolicyRoute = new Hono()
  .get("/:id/policy", requireAuth, zv("param", walletIdParam), async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id, c.get("session"));
    // Materialize bản default cho ví cũ ngay lần đọc đầu — GET xong là PUT có
    // bản active để so nâng/hạ, không còn nhánh "ví chưa có chính sách".
    const active = await policyRepo.ensureActivePolicy(wallet.id, user.id);
    const pending = await policyRepo.pendingPolicy(wallet.id);
    return c.json({
      data: {
        active: policyView(active),
        pending: pending ? policyView(pending) : null,
        onchainCapStroops: ONCHAIN_CAP_STROOPS.toString(),
      },
    });
  })
  .put(
    "/:id/policy",
    requireAuth,
    writeLimit,
    zv("param", walletIdParam),
    zv("json", putPolicyBody),
    async (c) => {
      const user = c.get("user");
      if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
      const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id, c.get("session"));
      const body = c.req.valid("json");
      const next = {
        perTxLimit: BigInt(body.per_tx_limit),
        dailyLimit: BigInt(body.daily_limit),
      };
      try {
        assertValidLimits(next); // E2: >0 · daily ≥ per_tx · ≤ trần on-chain
      } catch (err) {
        if (err instanceof PolicyValidationError) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }
      const current = await policyRepo.ensureActivePolicy(wallet.id, user.id);
      if (current.perTxLimit === next.perTxLimit && current.dailyLimit === next.dailyLimit) {
        // Không đổi gì — nhưng vẫn dọn pending nếu người dùng "đặt lại như cũ".
        const dropped = await policyRepo.cancelPending(wallet.id);
        if (dropped) {
          await appendPolicyAudit({
            walletId: wallet.id,
            kind: "policy.raise_cancelled",
            actorType: "owner",
            actorId: user.id,
            payload: { version: dropped.version, via: "reset_to_current" },
          });
          notifyRaiseCancelled(user.id);
        }
        return c.json({ data: { kind: "unchanged", active: policyView(current), pending: null } });
      }

      let result: Awaited<ReturnType<typeof policyRepo.proposeChange>>;
      try {
        result = await policyRepo.proposeChange({
          walletId: wallet.id,
          userId: user.id,
          next,
          current,
        });
      } catch (err) {
        if ((err as Error).message === "POLICY_CONFLICT") {
          throw new HTTPException(409, { message: "POLICY_CONFLICT" });
        }
        throw err;
      }

      if (result.kind === "pending") {
        // B4 + B9 — email NGAY khi có đề nghị nâng, kèm chỉ dẫn huỷ; B8 audit.
        await appendPolicyAudit({
          walletId: wallet.id,
          kind: "policy.raise_requested",
          actorType: "owner",
          actorId: user.id,
          payload: {
            perTxLimit: next.perTxLimit.toString(),
            dailyLimit: next.dailyLimit.toString(),
            effectiveAt: result.policy.effectiveAt.toISOString(),
            version: result.policy.version,
          },
        });
        await notifyRaiseRequested({
          walletId: wallet.id,
          perTxLimit: next.perTxLimit,
          dailyLimit: next.dailyLimit,
        });
        const active = await policyRepo.activePolicy(wallet.id);
        return c.json({
          data: {
            kind: "pending",
            active: active ? policyView(active) : policyView(current),
            pending: policyView(result.policy),
          },
        });
      }

      // Hạ → đã áp ngay (B1). Audit đường áp (B8).
      await appendPolicyAudit({
        walletId: wallet.id,
        kind: "policy.change_applied",
        actorType: "owner",
        actorId: user.id,
        payload: {
          perTxLimit: next.perTxLimit.toString(),
          dailyLimit: next.dailyLimit.toString(),
          version: result.policy.version,
          mode: "lower_immediate",
        },
      });
      return c.json({
        data: { kind: "applied", active: policyView(result.policy), pending: null },
      });
    },
  )
  .delete("/:id/policy/pending", requireAuth, writeLimit, zv("param", walletIdParam), async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const wallet = await requireOwnedWallet(user.id, c.req.valid("param").id, c.get("session"));
    const cancelled = await policyRepo.cancelPending(wallet.id);
    if (!cancelled) throw new HTTPException(404, { message: "NO_PENDING_POLICY" });
    await appendPolicyAudit({
      walletId: wallet.id,
      kind: "policy.raise_cancelled",
      actorType: "owner",
      actorId: user.id,
      payload: { version: cancelled.version },
    });
    notifyRaiseCancelled(user.id); // B7 — banner biến mất realtime
    const active = await policyRepo.activePolicy(wallet.id);
    return c.json({
      data: {
        kind: "cancelled",
        active: active ? policyView(active) : null,
        pending: null,
      },
    });
  });
