import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { publishDomainEvent } from "@/lib/domain-events";
import { guardians } from "../../guardians/infra/guardians.schema";
// Ngoại lệ TẦNG SCHEMA có chủ đích (như intents.repository): audit + notify ghi cùng nơi.
import { auditLog } from "../../indexer/infra/audit-log.schema";
import { notifications } from "../../notifications/infra/notifications.schema";
import { type Wallet, wallets } from "../../wallets/infra/wallets.schema";
import { approversFromSignals, type PublicRecoveryProgress } from "../domain/approvers";
import { recoveryDeviceRequests } from "./device-requests.schema";
import { type RecoveryRequest, recoveryRequests } from "./recovery-requests.schema";

const LIST_LIMIT = 100;

/** Kênh thông báo khôi phục — CỐ Ý trùng `CHANNELS` của send-flow/notify.ts.
 * Không import chéo module (luật module-boundary: intents không phải facade của
 * recovery), nên chép hằng số kèm nguyên lý do; `notify-channels.test.ts` gác
 * để hai bên không lệch nhau trong im lặng. */
const RECOVERY_NOTIFY_CHANNELS = ["email", "sse"] as const;

export async function walletById(walletId: string): Promise<Wallet | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  return row ?? null;
}

/** Guardian ĐANG HIỆU LỰC (chưa removed) của ví, gắn với user đang đăng nhập. */
export async function guardianOfWalletForUser(
  walletId: string,
  userId: string,
): Promise<{ id: string; onchainKey: string | null } | null> {
  const [row] = await db
    .select({ id: guardians.id, onchainKey: guardians.onchainKey })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        eq(guardians.userId, userId),
        ne(guardians.status, "removed"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Khoá on-chain của MỌI guardian hiệu lực — cho register_wallet. */
export async function activeGuardianKeys(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ onchainKey: guardians.onchainKey })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        ne(guardians.status, "removed"),
        isNotNull(guardians.onchainKey),
      ),
    );
  return rows.map((r) => r.onchainKey).filter((k): k is string => k !== null);
}

/** Audit hành động on-chain do NGƯỜI làm (mirror trạng thái là việc của indexer). */
export async function appendOnchainAudit(entry: {
  walletId: string;
  kind: string;
  actorType: "owner" | "guardian";
  actorId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values(entry);
}

export async function walletByStellarAddress(address: string): Promise<Wallet | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.stellarAddress, address)).limit(1);
  return row ?? null;
}

/**
 * THU HỒI mọi JWT ví đã phát (closeout §4): tăng số hiệu phiên một bậc.
 *
 * Gọi khi recovery hoàn tất. Sau `recovery_rotate`, thiết bị cũ mất quyền KÝ ngay
 * (on-chain), nhưng JWT phát trước đó vẫn tự chứng tới hết `exp` — kẻ chiếm thiết
 * bị cũ hết ký được nhưng chưa hết ĐỌC. Tăng bậc ở đây làm chúng chết ngay.
 *
 * Trả về số hiệu mới để caller ghi nhật ký; `UPDATE ... RETURNING` nên nguyên tử,
 * không đọc-rồi-ghi (hai recovery song song vẫn không mất bậc nào).
 */
export async function bumpWalletJwtVersion(walletId: string): Promise<number | null> {
  const [row] = await db
    .update(wallets)
    .set({ jwtVersion: sql`${wallets.jwtVersion} + 1` })
    .where(eq(wallets.id, walletId))
    .returning({ v: wallets.jwtVersion });
  return row?.v ?? null;
}

/** Số hiệu phiên hiện tại theo địa chỉ ví — cửa verify JWT tra ở đây. */
export async function jwtVersionByStellarAddress(address: string): Promise<number | null> {
  const [row] = await db
    .select({ v: wallets.jwtVersion })
    .from(wallets)
    .where(eq(wallets.stellarAddress, address))
    .limit(1);
  return row?.v ?? null;
}

/** Máy mới gõ cửa: MỖI ví một request mở — cái mới đè cái cũ (superseded),
 * tránh guardian nhìn thấy chồng chất vật liệu khoá lẫn lộn.
 *
 * Ghi `audit_log` trong CÙNG transaction (lô R1). Trước đó "có người xin khôi
 * phục ví của bạn" không để lại một dòng nào trong nhật ký kiểm tra — sự kiện an
 * ninh nặng nhất của hệ lại là sự kiện duy nhất không có dấu vết, nên khi thông
 * báo chết lặng thì không còn chỗ nào để đối chiếu. `actorType: "system"` vì cửa
 * public không có ai đã-xác-thực đứng sau; `fingerprint` là dữ liệu chủ ví ĐỌC TO
 * qua điện thoại (không bí mật), còn `key_base64` thì KHÔNG vào audit. */
export async function upsertDeviceRequest(input: {
  walletId: string;
  verifier: string;
  keyBase64: string;
  fingerprint: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(recoveryDeviceRequests)
      .set({ status: "superseded" })
      .where(
        and(
          eq(recoveryDeviceRequests.walletId, input.walletId),
          eq(recoveryDeviceRequests.status, "open"),
        ),
      );
    await tx.insert(recoveryDeviceRequests).values({ ...input, status: "open" });
    await tx.insert(auditLog).values({
      walletId: input.walletId,
      kind: "recovery.device_requested",
      actorType: "system",
      payload: { fingerprint: input.fingerprint, verifier: input.verifier },
    });
  });
}

/** Notify MỌI guardian hiệu lực CÓ TÀI KHOẢN của ví: thiết bị mới xin khôi phục.
 * (guardians.userId nullable — người được mời chưa có account thì chưa notify được.)
 *
 * KÊNH: email + sse — GIỐNG HỆT send-flow/notify.ts, và vì đúng lý do đó:
 * push CHƯA cấu hình (dispatcher ném PermanentDispatchError PUSH_NOT_CONFIGURED,
 * `/ready` báo `push:"disabled"`), nên enqueue push là enqueue vào hư không.
 *
 * Đây KHÔNG phải lỗi giả định — nó đã xảy ra thật ngày 30/07: ba guardian nhận
 * đúng ba dòng `channel='push'` → cả ba `failed/PUSH_NOT_CONFIGURED`, không ai
 * biết có người đang cầu cứu. Email là kênh NGOÀI APP duy nhất còn sống, và với
 * ca dùng chính của luồng này — chủ ví mất máy, guardian có thể cả tuần chưa mở
 * app — nó là kênh DUY NHẤT có ý nghĩa. `notify-channels.test.ts` khoá lại. */
export async function notifyGuardiansDeviceRequested(walletId: string): Promise<void> {
  const rows = await db
    .select({ userId: guardians.userId })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        ne(guardians.status, "removed"),
        isNotNull(guardians.userId),
      ),
    );
  for (const g of rows) {
    if (!g.userId) continue;
    for (const channel of RECOVERY_NOTIFY_CHANNELS) {
      await db.insert(notifications).values({
        userId: g.userId,
        templateKey: "recovery.device_requested",
        params: {},
        channel,
      });
    }
    // Realtime NGAY (khuôn notify.ts:51-52) — hàng đợi trên là email/hộp thư,
    // tick sau mới tới. Guardian đang mở app thấy trong vài giây.
    // Payload RỖNG theo luật domain-events: không địa chỉ ví, không id nội bộ.
    publishDomainEvent(g.userId, "recovery.device_requested");
  }
}

/** Tiến độ khôi phục PUBLIC theo địa chỉ — chỉ trường vô hại (vốn public on-chain).
 * approvers: ai đã duyệt (địa chỉ THAM SỐ lời gọi + tx hash) — cũng public on-chain. */
export async function publicProgressByAddress(
  address: string,
): Promise<PublicRecoveryProgress | null> {
  const [row] = await db
    .select({
      status: recoveryRequests.status,
      approvals: recoveryRequests.approvals,
      threshold: recoveryRequests.threshold,
      vetoUntil: recoveryRequests.vetoUntil,
      startedAt: recoveryRequests.startedAt,
      signals: recoveryRequests.signals,
    })
    .from(recoveryRequests)
    .innerJoin(wallets, eq(recoveryRequests.walletId, wallets.id))
    .where(eq(wallets.stellarAddress, address))
    .orderBy(desc(recoveryRequests.startedAt))
    .limit(1);
  if (!row) return null;
  return {
    status: row.status,
    approvals: row.approvals,
    threshold: row.threshold,
    vetoUntil: row.vetoUntil ? row.vetoUntil.toISOString() : null,
    startedAt: row.startedAt.toISOString(),
    approvers: approversFromSignals(row.signals),
  };
}

// Audit 2026-07-25 (§6.5): `status` lọc TRONG SQL, không sau LIMIT. Ở đúng bảng này
// hậu quả nặng nhất: `?status=pending` bỏ sót một yêu cầu khôi phục đang mở chỉ vì
// nó nằm ngoài 100 dòng mới nhất — chủ ví không thấy để mà phủ quyết.
export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  status?: string,
  limit = LIST_LIMIT,
): Promise<RecoveryRequest[]> {
  const scope = and(eq(recoveryRequests.walletId, walletId), eq(wallets.userId, ownerUserId));
  const rows = await db
    .select({ request: recoveryRequests })
    .from(recoveryRequests)
    .innerJoin(wallets, eq(recoveryRequests.walletId, wallets.id))
    .where(status ? and(scope, eq(recoveryRequests.status, status)) : scope)
    .orderBy(desc(recoveryRequests.startedAt))
    .limit(limit);
  return rows.map((r) => r.request);
}
