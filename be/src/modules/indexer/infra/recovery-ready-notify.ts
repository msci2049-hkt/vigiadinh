// Lô R6 — yêu cầu khôi phục vừa ĐỦ PHIẾU (pending → ready).
//
// Vì sao mốc này phải có tiếng nói riêng: `recovery.approved` là "THÊM MỘT người
// thân đã xác nhận" — đúng nghĩa từng phiếu, và chủ ví nhận nó cả khi còn thiếu
// người. Mốc đủ phiếu thì khác hẳn: từ giây này đồng hồ chặn chạy thật, hết giờ
// là ví đổi chủ. Trước lô này chủ ví nhận ĐÚNG KHÔNG GÌ CẢ ở mốc đó — không email
// (không template), không SSE (không domain event), không banner. Đường thứ hai
// `recovery-watch` cũng câm vì cờ Redis chống-spam đã tiêu ở lúc MỞ lệnh.
//
// KÊNH: email + sse — CỐ Ý trùng RECOVERY_NOTIFY_CHANNELS của recovery.repository.ts
// (không import chéo module — luật module-boundary): push CHƯA cấu hình, enqueue
// push là enqueue vào hư không (sự cố 30/07).
//
// Guardian KHÔNG nhận email ở mốc này (việc của họ đã xong, thêm thư là làm loãng
// đúng lá thư cần đọc) nhưng CÓ nhận domain event, để thẻ trên màn họ đang mở đổi
// sang "đủ phiếu, đang chờ" thay vì vẫn mời bấm ký.
import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { db } from "@/db";
import { publishDomainEvent } from "@/lib/domain-events";
import { enqueueNotificationTx } from "@/modules/notifications";
import { guardians } from "../../guardians/infra/guardians.schema";
import { auditLog } from "./audit-log.schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Báo CHỦ VÍ (email+sse) + đẩy realtime cho chủ ví lẫn mọi guardian + audit.
 * Chạy TRONG tx của batch indexer; caller chỉ gọi khi mirror THẬT SỰ vừa chuyển
 * pending → ready (UPDATE có mệnh đề `status='pending'` nên đúng một lần). */
export async function notifyRecoveryThresholdMet(
  tx: Tx,
  input: { walletId: string; ownerUserId: string; eventId: string; hoursLeft: number },
): Promise<void> {
  for (const channel of ["email", "sse"] as const) {
    await enqueueNotificationTx(tx, {
      userId: input.ownerUserId,
      templateKey: "recovery.threshold_met",
      params: { walletId: input.walletId, eventId: input.eventId, hours: input.hoursLeft },
      channel,
    });
  }
  // Payload RỖNG theo luật domain-events: không địa chỉ ví, không id nội bộ.
  publishDomainEvent(input.ownerUserId, "recovery.ready");

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
  let guardiansPinged = 0;
  for (const g of rows) {
    if (!g.userId) continue;
    publishDomainEvent(g.userId, "recovery.ready");
    guardiansPinged += 1;
  }

  // Sự kiện an ninh — phải có dấu vết riêng, kể cả khi không guardian nào online.
  await tx.insert(auditLog).values({
    walletId: input.walletId,
    kind: "recovery.threshold_met",
    actorType: "system",
    payload: { eventId: input.eventId, hoursLeft: input.hoursLeft, guardiansPinged },
  });
}
