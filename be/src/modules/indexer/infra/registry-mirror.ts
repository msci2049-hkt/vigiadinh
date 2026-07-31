// Mirror registry on-chain (PHA 5.2, tách khỏi indexer.service ở lô R6 vì trần
// 300 dòng/file) — nguồn sự thật = chain, indexer là NGƯỜI GHI DUY NHẤT của
// `recovery_requests` (route ghi chỉ audit). Idempotent nhờ dedupe PK event id
// ở pollOnce; các mốc "chỉ báo một lần" còn tự gác thêm bằng WHERE (xem `approve`).
import { and, eq, inArray, sql } from "drizzle-orm";
import type { db } from "@/db";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { toJsonSafe } from "../domain/json-safe";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ví đã khớp (indexer.service.findWallet) — chỉ các trường mirror cần. */
export type MirrorWallet = {
  id: string;
  ownerUserId: string;
  threshold: number;
  timelockSecs: number;
};

/** Trạng thái mirror còn "sống" — mọi cập nhật registry chỉ chạm các dòng này. */
export const ACTIVE_MIRROR = inArray(recoveryRequests.status, ["pending", "ready"]);

/**
 * Hệ quả của MỘT event lên mirror. Hai mốc dưới đây báo cho hai nhóm người khác
 * nhau nên không gộp được vào một cờ:
 *  - `closedRecovery` (R5): lệnh vừa ĐÓNG → báo mọi guardian, kể cả người chưa duyệt.
 *  - `thresholdMet` (R6): lệnh vừa ĐỦ PHIẾU → báo CHỦ VÍ, vì đây là lúc đồng hồ
 *    chặn bắt đầu chạy thật và họ chỉ còn từng ấy giờ để phủ quyết.
 */
export type MirrorEffect = {
  closedRecovery: boolean;
  thresholdMet: { hoursLeft: number } | null;
};

export const NO_MIRROR_EFFECT: MirrorEffect = { closedRecovery: false, thresholdMet: null };

const closed = (): MirrorEffect => ({ closedRecovery: true, thresholdMet: null });

/** Giờ còn lại tới mốc chặn — làm TRÒN LÊN (còn 10 phút vẫn phải nói "1 giờ",
 * nói "0 giờ" là mời người ta bỏ cuộc). Không có mốc thì rơi về timelock ví. */
function hoursLeftFrom(vetoUntil: Date | null, timelockSecs: number): number {
  if (!vetoUntil) return Math.max(1, Math.ceil(timelockSecs / 3600));
  return Math.max(0, Math.ceil((vetoUntil.getTime() - Date.now()) / 3_600_000));
}

export async function applyRegistryMirror(
  tx: Tx,
  kind: string,
  wallet: MirrorWallet,
  event: { data: Record<string, unknown> },
): Promise<MirrorEffect> {
  const data = event.data as { value?: unknown; txHash?: unknown };
  const walletScope = eq(recoveryRequests.walletId, wallet.id);
  switch (kind) {
    case "initiate": {
      // Registry v2: value = (initiator Address, fingerprint sha256 của Signer mới).
      // newOwner (varchar 56) lưu fingerprint hex CẮT 56 ký tự (28B — đủ đối chiếu
      // UI/audit; khoá đầy đủ nằm on-chain qua get_recovery_status). vetoUntil ƯỚC
      // LƯỢNG từ mirror timelock ví (mốc chuẩn = started_at contract).
      const value = data.value;
      if (!Array.isArray(value)) return NO_MIRROR_EFFECT;
      const fp = value[1];
      if (!(fp instanceof Uint8Array)) return NO_MIRROR_EFFECT;
      const initiator = typeof value[0] === "string" ? value[0] : null;
      const txHash = typeof data.txHash === "string" ? data.txHash.slice(0, 64) : null;
      // R6: ví ngưỡng 1 thì contract mở xong là Approved NGAY (lib.rs:323-327) —
      // mirror ghi "pending" ở đây là nói dối ngay từ dòng đầu, và người xin khôi
      // phục kẹt vĩnh viễn ở màn chờ phiếu vì không phiếu nào tới nữa.
      const bornReady = wallet.threshold <= 1;
      await tx.insert(recoveryRequests).values({
        walletId: wallet.id,
        newOwner: Buffer.from(fp).toString("hex").slice(0, 56),
        status: bornReady ? "ready" : "pending",
        // Contract đếm NGƯỜI MỞ là phiếu ĐẦU TIÊN (recovery-registry/src/lib.rs:311-312
        // push initiator vào approvals; test.rs:318-342: g1 mở xong bỏ phiếu lại →
        // AlreadyApproved). Mirror khởi tạo 0 là nói dối: UI báo 0/2 khi chain đã 1/2,
        // và guardian mở yêu cầu bấm duyệt tiếp ăn CONTRACT_ERROR:AlreadyApproved.
        approvals: 1,
        threshold: wallet.threshold,
        txHash,
        vetoUntil: new Date(Date.now() + wallet.timelockSecs * 1000),
        // Người duyệt = địa chỉ trong THAM SỐ lời gọi (initiator), KHÔNG phải source
        // account của tx — source là ví phí dùng chung, không nhận dạng ai. Màn tiến
        // trình đọc danh sách này (jsonb có sẵn — không migration).
        signals: toJsonSafe({
          approvers: initiator ? [{ guardian: initiator, txHash }] : [],
        }),
      });
      return {
        closedRecovery: false,
        thresholdMet: bornReady ? { hoursLeft: hoursLeftFrom(null, wallet.timelockSecs) } : null,
      };
    }
    case "approve": {
      // value = (guardian, approvals_len) → native [string, number].
      const value = data.value;
      const approvalsLen = Array.isArray(value) ? Number(value[1]) : Number.NaN;
      if (!Number.isFinite(approvalsLen)) return NO_MIRROR_EFFECT;
      const guardian = Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
      const txHash = typeof data.txHash === "string" ? data.txHash.slice(0, 64) : null;
      // Nối người duyệt vào signals.approvers TRONG SQL (giữ nguyên key khác của
      // jsonb nếu risk engine đã ghi). Replay event đã bị dedupe PK chặn ở pollOnce.
      const approverJson = JSON.stringify(toJsonSafe({ guardian, txHash }));
      await tx
        .update(recoveryRequests)
        .set({
          approvals: approvalsLen,
          ...(guardian
            ? {
                signals: sql`coalesce(${recoveryRequests.signals}, '{}'::jsonb)
                  || jsonb_build_object('approvers',
                       coalesce(${recoveryRequests.signals}->'approvers', '[]'::jsonb)
                       || ${approverJson}::jsonb)`,
              }
            : {}),
        })
        .where(and(walletScope, ACTIVE_MIRROR));

      // R6 — mốc ĐỦ PHIẾU. Trước lô này không một dòng nào trong be/ so `approvals`
      // với `threshold`, nên `'ready'` chỉ tồn tại trong CHECK constraint và mệnh đề
      // ĐỌC: chủ ví không được cảnh báo, và người xin khôi phục kẹt ở nút disabled
      // (`recovery/progress.tsx` gate `status === "ready"`).
      //
      // Câu UPDATE này TỰ NÓ là bộ đếm một-lần: nó chỉ khớp dòng còn `pending`, nên
      // guardian thứ ba bỏ phiếu khi chain đã Approved (lib.rs:346 vẫn cho) không
      // khớp dòng nào và không báo lại. Gác nằm ở DB, không phụ thuộc dedupe event.
      //
      // So với `threshold` CỦA DÒNG (chốt lúc mở yêu cầu), KHÔNG phải wallets.threshold:
      // chủ ví đổi ngưỡng giữa chừng không được đổi luật của yêu cầu đang chạy. Dòng
      // cũ có thể còn NULL (schema nullable) → coalesce về ngưỡng ví hiện tại.
      const promoted = await tx
        .update(recoveryRequests)
        .set({ status: "ready" })
        .where(
          and(
            walletScope,
            eq(recoveryRequests.status, "pending"),
            sql`${recoveryRequests.approvals} >= coalesce(${recoveryRequests.threshold}, ${wallet.threshold})`,
          ),
        )
        .returning({ vetoUntil: recoveryRequests.vetoUntil });
      const row = promoted[0];
      return {
        closedRecovery: false,
        thresholdMet: row ? { hoursLeft: hoursLeftFrom(row.vetoUntil, wallet.timelockSecs) } : null,
      };
    }
    case "cancel": {
      const rows = await tx
        .update(recoveryRequests)
        .set({ status: "vetoed" })
        .where(and(walletScope, ACTIVE_MIRROR))
        .returning({ id: recoveryRequests.id });
      return rows.length > 0 ? closed() : NO_MIRROR_EFFECT;
    }
    case "finalize": {
      const rows = await tx
        .update(recoveryRequests)
        .set({ status: "executed" })
        .where(and(walletScope, ACTIVE_MIRROR))
        .returning({ id: recoveryRequests.id });
      return rows.length > 0 ? closed() : NO_MIRROR_EFFECT;
    }
    default:
      return NO_MIRROR_EFFECT;
  }
}
