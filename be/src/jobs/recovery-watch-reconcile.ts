// Lô R7 — DỌN dòng mirror đã chết trên chain nhưng còn nằm ở `pending`/`ready`.
//
// Bệnh: `recovery_requests` có 5 đường ghi và KHÔNG đường nào set `'expired'` —
// giá trị đó chỉ tồn tại trong CHECK constraint. Một yêu cầu chết trên chain
// (hết hạn / bị ghi đè bởi yêu cầu mới) nằm mãi trong DB dưới dạng `pending`,
// thành thẻ ma trong hộp thư người bảo hộ và banner ma trên hub ví. Đúng cảnh
// 31/07: `/night-watch` đọc mirror nói "có người đang chiếm ví", `/block` đọc
// chain nói "không có yêu cầu nào để chặn" — hai màn cãi nhau, chủ ví không
// biết tin ai.
//
// 🔴 KHÔNG GỬI EMAIL ở đây (C5). Hết hạn không phải sự kiện đáng báo động —
// không ai bị tấn công, không ai cần hành động. Đây là dọn dẹp im lặng. Gửi
// thư mỗi lần một yêu cầu cũ hết hạn là dạy người dùng bỏ qua thư của chúng ta,
// mà thư khôi phục là thứ họ phải đọc.
//
// Người GÁC quyết định nằm ở `@/modules/recovery` (`stale-mirror.ts`) — thuần,
// test được không cần chain/DB. File này chỉ thi hành, sau khi đã được cho phép.
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { publishDomainEvent } from "@/lib/domain-events";
import { guardians } from "@/modules/guardians/infra/guardians.schema";
import { auditLog } from "@/modules/indexer/infra/audit-log.schema";
import { recoveryRequests } from "@/modules/recovery/infra/recovery-requests.schema";

/**
 * Đóng mọi dòng mirror còn sống của MỘT ví thành `'expired'`.
 *
 * Chỉ gọi khi `chainSaysRequestIsDead` đã đồng ý — hàm này KHÔNG tự phán xét gì.
 * Trả về số dòng đã dọn (0 = không có gì để dọn, đường chạy bình thường nhất).
 */
export async function expireStaleMirrorRows(input: {
  walletId: string;
  ownerUserId: string;
  /** Vì sao chain kết luận là chết — vào audit để tra ngược được. */
  reason: string;
}): Promise<number> {
  return db.transaction(async (tx) => {
    // WHERE chỉ khớp `pending`/`ready`. Đây là chỗ bảo vệ lịch sử: một lần
    // khôi phục đã `executed` hoặc đã bị `vetoed` KHÔNG BAO GIỜ bị viết đè
    // thành `expired` — nhật ký khôi phục không được nói dối về chuyện đã rồi
    // (cùng bài học với R6 nhánh `recovery.vetoed`).
    const cleaned = await tx
      .update(recoveryRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(recoveryRequests.walletId, input.walletId),
          inArray(recoveryRequests.status, ["pending", "ready"]),
        ),
      )
      .returning({ id: recoveryRequests.id });
    if (cleaned.length === 0) return 0;

    // C6 — dấu vết. Dòng biến mất khỏi màn hình mà không ai biết vì sao là cách
    // nhanh nhất để mất niềm tin vào chính cơ chế dọn này.
    await tx.insert(auditLog).values({
      walletId: input.walletId,
      kind: "recovery.expired",
      actorType: "system",
      payload: {
        requestIds: cleaned.map((r) => r.id),
        reason: input.reason,
        source: "recovery-watch",
      },
    });

    // C4 — thẻ ma phải biến mất khỏi màn đang mở. Tái dùng `recovery.closed`:
    // với người xem thì "yêu cầu này không còn nữa" là đúng một chuyện, và FE
    // đã nghe key đó từ R5 (invalidate hộp thư guardian). Payload RỖNG theo
    // luật domain-events — không địa chỉ ví, không id nội bộ.
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
    const audience = new Set<string>([input.ownerUserId]);
    for (const g of rows) if (g.userId) audience.add(g.userId);
    for (const userId of audience) publishDomainEvent(userId, "recovery.closed");

    return cleaned.length;
  });
}
