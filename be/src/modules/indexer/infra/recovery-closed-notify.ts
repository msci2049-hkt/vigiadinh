// Lô R5 nhóm A — yêu cầu khôi phục ĐÓNG (huỷ / veto / finalize) phải báo MỌI
// người bảo hộ của ví, kể cả người CHƯA duyệt. Sự cố tái lập 31/07: A huỷ lệnh,
// C (chưa duyệt) không nhận gì, thẻ vẫn nằm trên màn C, C bấm duyệt và ăn lỗi.
//
// Kênh email + sse — CỐ Ý trùng RECOVERY_NOTIFY_CHANNELS của
// recovery.repository.ts (không import chéo module — luật module-boundary):
// push CHƯA cấu hình, enqueue push là enqueue vào hư không (sự cố 30/07).
// publishDomainEvent để màn guardian đang mở invalidate ngay (≤10s), hàng đợi
// sse/email là lưới đỡ cho người không mở app.
import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { db } from "@/db";
import { publishDomainEvent } from "@/lib/domain-events";
import { enqueueNotificationTx } from "@/modules/notifications";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "./audit-log.schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Báo mọi guardian hiệu lực CÓ TÀI KHOẢN + ghi audit — chạy TRONG tx của batch
 * indexer (event dedupe bằng PK nên không gửi trùng khi RPC trả lặp trang). */
export async function notifyGuardiansRecoveryClosed(
  tx: Tx,
  input: { walletId: string; eventId: string; closedBy: string },
): Promise<void> {
  const rows = await tx
    .select({ userId: guardians.userId })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, input.walletId),
        ne(guardians.status, "removed"),
        isNotNull(guardians.userId),
      ),
    );
  let notified = 0;
  for (const g of rows) {
    if (!g.userId) continue;
    for (const channel of ["email", "sse"] as const) {
      await enqueueNotificationTx(tx, {
        userId: g.userId,
        templateKey: "recovery.closed",
        params: { walletId: input.walletId, eventId: input.eventId },
        channel,
      });
    }
    // Payload RỖNG theo luật domain-events: không địa chỉ ví, không id nội bộ.
    publishDomainEvent(g.userId, "recovery.closed");
    notified += 1;
  }
  // Sự kiện an ninh — phải có dấu vết riêng, kể cả khi notified = 0 (ví chưa
  // có guardian nào có tài khoản vẫn cần biết lệnh đã đóng lúc nào, vì đâu).
  await tx.insert(auditLog).values({
    walletId: input.walletId,
    kind: "recovery.closed",
    actorType: "system",
    payload: { eventId: input.eventId, closedBy: input.closedBy, guardiansNotified: notified },
  });
}
