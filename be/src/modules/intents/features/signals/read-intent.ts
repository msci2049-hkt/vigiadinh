// Dùng chung cho HAI cửa đọc quanh một lệnh chuyển: /signals (lô R2) và
// /explain (lô R3). Cùng câu hỏi authz — "ai được nhìn thói quen chi tiêu của
// ví này?" — nên phải cùng MỘT câu trả lời: chủ ví (đúng scope passkey) hoặc
// guardian hiệu lực. Tách ra đây để hai handler không trôi khỏi nhau.
import { HTTPException } from "hono/http-exception";
import { assertWalletScope, type WalletScopedSession } from "@/lib/wallet-scope";
import { intentById, walletOwnedBy } from "../../infra/intents.repository";
import {
  isActiveGuardianUser,
  recipientHistory,
  spendingBaseline,
  velocityLastHour,
} from "../../infra/signals.repository";
import { type IntentSignals, intentSignalsView } from "./domain";

/** Intent thanh toán (amount/recipient non-null) mà user này được ĐỌC.
 * Không tồn tại / phi-thanh-toán → 404 (không lộ "tồn tại nhưng khác loại");
 * người thứ ba → 403. */
export async function loadReadableIntent(
  intentId: string,
  userId: string,
  session: WalletScopedSession,
): Promise<{ walletId: string; amount: bigint; recipient: string; policyDecision: string | null }> {
  const intent = await intentById(intentId);
  if (!intent || intent.amount === null || intent.recipient === null) {
    throw new HTTPException(404, { message: "INTENT_NOT_FOUND" });
  }
  const owner = await walletOwnedBy(intent.walletId, userId);
  if (owner) {
    // Chủ ví nhưng session passkey đang scope ví khác → 403 như các cửa intent.
    assertWalletScope(session, intent.walletId);
  } else if (!(await isActiveGuardianUser(intent.walletId, userId))) {
    throw new HTTPException(403, { message: "NOT_WALLET_OWNER_OR_GUARDIAN" });
  }
  return {
    walletId: intent.walletId,
    amount: intent.amount,
    recipient: intent.recipient,
    policyDecision: intent.policyDecision,
  };
}

/** Ba câu SQL lớp 2 → IntentSignals. Deterministic, không LLM. */
export async function computeIntentSignals(intent: {
  walletId: string;
  amount: bigint;
  recipient: string;
  policyDecision: string | null;
}): Promise<IntentSignals> {
  const now = new Date();
  const [velocity, recipient, baseline] = await Promise.all([
    velocityLastHour(intent.walletId, now),
    recipientHistory(intent.walletId, intent.recipient),
    spendingBaseline(intent.walletId, now),
  ]);
  return intentSignalsView({
    amount: intent.amount,
    recipient: intent.recipient,
    policyDecision: intent.policyDecision,
    velocity,
    recipientSettledCount: recipient.settledCount,
    baseline,
  });
}
