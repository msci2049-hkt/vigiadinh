// CHỦ VÍ rút lại lệnh khi tiền CHƯA đi (LÔ 1 A6). Transition `cancel` có sẵn
// trong bảng state machine từ PHA 3 nhưng chưa từng có call-site — đây là
// call-site đầu tiên.
//
// Chống race với guardian đang duyệt song song: UPDATE có điều kiện
// `WHERE status = <status vừa đọc>` — status đổi giữa chừng (guardian vừa
// approve → awaiting_signature, hoặc đã settled) thì 0 row → 409 cho client
// nhìn lại. KHÔNG BAO GIỜ đè lên settled/submitting.
import { publishDomainEvent } from "@/lib/domain-events";
import { assertTransition } from "../../domain/state-machine";
import {
  cancelIntentIfStatus,
  expirePendingApprovals,
  guardianUserIdsForWallet,
} from "../../infra/approvals.repository";
import * as repo from "../../infra/intents.repository";

export class CancelError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409,
    code: string,
  ) {
    super(code);
  }
}

export async function cancelIntent(input: {
  intentId: string;
  userId: string;
}): Promise<{ intentId: string; status: "cancelled" }> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new CancelError(404, "INTENT_NOT_FOUND");
  const owned = await repo.walletOwnedBy(intent.walletId, input.userId);
  if (!owned) throw new CancelError(403, "NOT_OWNER");

  try {
    assertTransition(intent.status as Parameters<typeof assertTransition>[0], "owner", "cancel");
  } catch (err) {
    throw new CancelError(409, err instanceof Error ? err.message : "INVALID_TRANSITION");
  }

  const cancelled = await cancelIntentIfStatus(intent.id, intent.status);
  if (!cancelled) throw new CancelError(409, "INTENT_STATE_CHANGED");

  await expirePendingApprovals(intent.id);
  await repo.appendIntentAudit({
    walletId: intent.walletId,
    kind: "intent.cancelled",
    actorType: "owner",
    actorId: input.userId,
    payload: { intentId: intent.id, fromStatus: intent.status },
  });
  // Realtime (LÔ 3): guardian đang mở "Chờ bạn duyệt" thấy phiếu biến mất ngay,
  // không bấm duyệt một lệnh đã chết. Fire-and-forget — lỗi không hỏng cancel.
  try {
    for (const uid of await guardianUserIdsForWallet(intent.walletId)) {
      publishDomainEvent(uid, "intent.cancelled");
    }
  } catch {
    // đã có audit + refetch-on-focus làm lưới đỡ
  }
  return { intentId: intent.id, status: "cancelled" };
}
