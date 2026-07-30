// GET /api/intents/:intentId/signals — tín hiệu rủi ro deterministic quanh một
// lệnh chuyển (lô R2). KHÔNG LLM, KHÔNG số dư: chỉ con số về giao dịch, cho hai
// màn đang phải quyết — guardian duyệt hộ và chủ ví chờ duyệt.
//
// Authz: chủ ví (đúng scope passkey) HOẶC guardian hiệu lực của ví. Người thứ
// ba → 403. Khuôn theo pending-approvals/pending-signature.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { assertWalletScope } from "@/lib/wallet-scope";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { intentById, walletOwnedBy } from "../../infra/intents.repository";
import {
  isActiveGuardianUser,
  recipientHistory,
  spendingBaseline,
  velocityLastHour,
} from "../../infra/signals.repository";
import { intentSignalsView } from "./domain";

const signalsParam = z.object({ intentId: z.string().length(26) });

export const intentSignalsRoute = new Hono().get(
  "/:intentId/signals",
  requireAuth,
  zv("param", signalsParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { intentId } = c.req.valid("param");

    const intent = await intentById(intentId);
    if (!intent) throw new HTTPException(404, { message: "INTENT_NOT_FOUND" });
    // Intent phi-thanh-toán (đổi cấu hình) không có tiền để nói — coi như
    // không có tín hiệu, cùng mã 404 để không lộ "intent tồn tại nhưng khác loại".
    if (intent.amount === null || intent.recipient === null) {
      throw new HTTPException(404, { message: "INTENT_NOT_FOUND" });
    }

    const owner = await walletOwnedBy(intent.walletId, user.id);
    if (owner) {
      // Chủ ví nhưng session passkey đang scope ví khác → 403 như các cửa intent.
      assertWalletScope(c.get("session"), intent.walletId);
    } else if (!(await isActiveGuardianUser(intent.walletId, user.id))) {
      throw new HTTPException(403, { message: "NOT_WALLET_OWNER_OR_GUARDIAN" });
    }

    const now = new Date();
    const [velocity, recipient, baseline] = await Promise.all([
      velocityLastHour(intent.walletId, now),
      recipientHistory(intent.walletId, intent.recipient),
      spendingBaseline(intent.walletId, now),
    ]);

    return c.json({
      data: intentSignalsView({
        amount: intent.amount,
        recipient: intent.recipient,
        policyDecision: intent.policyDecision,
        velocity,
        recipientSettledCount: recipient.settledCount,
        baseline,
      }),
    });
  },
);
