// Truy vấn HỘP THƯ NGƯỜI BẢO HỘ — tách khỏi recovery.repository ở lô R6 (trần
// 300 dòng/file). Cả hai truy vấn ở đây scope bằng CÙNG một khuôn: INNER JOIN
// `guardians` theo `userId` của người đang xem + `status <> 'removed'`, nên
// người lạ và người đã bị gỡ không đọc được gì.
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { guardians } from "../../guardians/infra/guardians.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { approversFromSignals } from "../domain/approvers";
import { type RecoveryDeviceRequest, recoveryDeviceRequests } from "./device-requests.schema";
import { type RecoveryRequest, recoveryRequests } from "./recovery-requests.schema";

const LIST_LIMIT = 100;

/** Request thiết-bị-mới đang MỞ trên các ví user bảo hộ — cho màn initiate. */
export async function openDeviceRequestsForGuardianUser(
  userId: string,
): Promise<
  Array<{ deviceRequest: RecoveryDeviceRequest; wallet: { id: string; stellarAddress: string } }>
> {
  const rows = await db
    .select({
      deviceRequest: recoveryDeviceRequests,
      walletId: wallets.id,
      stellarAddress: wallets.stellarAddress,
    })
    .from(recoveryDeviceRequests)
    .innerJoin(wallets, eq(recoveryDeviceRequests.walletId, wallets.id))
    .innerJoin(
      guardians,
      and(
        eq(guardians.walletId, wallets.id),
        eq(guardians.userId, userId),
        ne(guardians.status, "removed"),
      ),
    )
    .where(eq(recoveryDeviceRequests.status, "open"))
    .orderBy(desc(recoveryDeviceRequests.createdAt))
    .limit(LIST_LIMIT);
  return rows.map((r) => ({
    deviceRequest: r.deviceRequest,
    wallet: { id: r.walletId, stellarAddress: r.stellarAddress },
  }));
}

export type GuardianInboxItem = {
  request: RecoveryRequest;
  wallet: {
    id: string;
    stellarAddress: string;
    threshold: number;
    timelockSecs: number;
    /**
     * R7 — TÊN chủ ví, để hộp thư nói "Ví của Nguyễn Hoàng Anh" thay vì
     * "Ví CA3NCR…TH5Y5W". Người bảo hộ nhận lời vì họ biết một CON NGƯỜI; bắt
     * họ nhận ra người thân qua 12 ký tự base32 là bắt sai người làm việc của
     * máy. `/protecting` đã hiện tên từ trước (`list-protecting`), hộp thư thì
     * chưa — cùng một ví hiện hai kiểu ở hai màn.
     *
     * `null` khi user chưa đặt tên → FE rơi về địa chỉ rút gọn.
     */
    ownerName: string | null;
  };
  /** R6 — NGƯỜI ĐANG XEM đã bỏ phiếu cho yêu cầu này chưa. */
  viewerApproved: boolean;
};

/** Yêu cầu ĐANG MỞ trên các ví user đang là guardian hiệu lực — hộp thư guardian.
 * Chỉ pending/ready: việc guardian là BỎ PHIẾU, chuyện đã đóng không nằm ở inbox.
 *
 * R6 — `viewerApproved` phải tính Ở ĐÂY, không đẩy sang FE: so `signals.approvers`
 * cần địa chỉ on-chain CỦA CHÍNH người đang xem, mà cửa duy nhất trả `onchain_key`
 * là danh sách người bảo hộ và nó owner-only (list-guardians/handler.ts). Không có
 * trường này thì màn ký sáng đèn cho cả người đã ký, họ chạm vân tay rồi mới ăn
 * `CONTRACT_ERROR:AlreadyApproved` — báo lỗi sau khi đã bắt người ta trả giá.
 *
 * Chỉ so khoá của CHÍNH dòng guardian đã JOIN theo `userId`, nên guardian A không
 * bao giờ đọc được trạng thái phiếu của guardian B qua trường này. */
export async function openRequestsForGuardianUser(
  userId: string,
  limit = LIST_LIMIT,
): Promise<GuardianInboxItem[]> {
  const rows = await db
    .select({
      request: recoveryRequests,
      walletId: wallets.id,
      stellarAddress: wallets.stellarAddress,
      threshold: wallets.threshold,
      timelockSecs: wallets.timelockSecs,
      ownerName: user.name,
      viewerKey: guardians.onchainKey,
    })
    .from(recoveryRequests)
    .innerJoin(wallets, eq(recoveryRequests.walletId, wallets.id))
    // R7 — tên chủ ví. 🔴 LEFT, không INNER: `wallets.userId` là SOFT REF (varchar,
    // không FK — luật db-schema), nên không có gì bảo đảm hàng `user` còn đó. INNER
    // JOIN sẽ ÂM THẦM NUỐT cả dòng khi thiếu, tức giấu một yêu cầu khôi phục đang
    // sống khỏi người bảo hộ — đúng loại bệnh lô này đang chữa. Thiếu tên thì mất
    // tên, không được mất yêu cầu.
    .leftJoin(user, eq(wallets.userId, user.id))
    .innerJoin(
      guardians,
      and(
        eq(guardians.walletId, wallets.id),
        eq(guardians.userId, userId),
        ne(guardians.status, "removed"),
      ),
    )
    .where(inArray(recoveryRequests.status, ["pending", "ready"]))
    .orderBy(desc(recoveryRequests.startedAt))
    .limit(limit);
  return rows.map((r) => ({
    request: r.request,
    wallet: {
      id: r.walletId,
      stellarAddress: r.stellarAddress,
      threshold: r.threshold,
      timelockSecs: r.timelockSecs,
      ownerName: r.ownerName,
    },
    // Chưa có khoá on-chain (người bảo hộ chưa nhận lời xong) → chưa thể đã ký.
    // FALSE ở đây là an toàn: cùng lắm màn ký vẫn mở như trước lô này.
    viewerApproved: r.viewerKey
      ? approversFromSignals(r.request.signals).some((a) => a.guardian === r.viewerKey)
      : false,
  }));
}
