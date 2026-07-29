// Thông báo + audit của luồng đổi ngưỡng chi tiêu (B4/B7/B8/B9).
//
// FIRE-AND-FORGET như send-flow/notify: enqueue chỉ là INSERT bảng
// notifications; lỗi ở đây KHÔNG được làm hỏng việc đổi chính sách. Kênh email
// đi ĐƯỜNG NGOÀI APP (khuôn recovery-watch): kẻ chiếm được app/session vẫn
// không chặn được thư "có người đòi nâng hạn mức ví của bạn" tới hộp mail chủ ví.
// Payload KHÔNG chở secret — chỉ số XLM đã format + số giờ chờ.
import { db } from "@/db";
import { env } from "@/env";
import { publishDomainEvent } from "@/lib/domain-events";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/modules/notifications";
import { auditLog } from "../../../indexer/infra/audit-log.schema";
import { RAISE_DELAY_SECONDS } from "../../domain/spending-policy";
import { guardianUserIds, ownerUserId } from "./queries";

const CHANNELS = ["email", "sse"] as const;

/** stroops → chuỗi XLM gọn (khuôn formatXlm bên intents — không import chéo module). */
export function formatXlmStroops(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Audit B8 — đề nghị · huỷ · áp, append-only cùng bảng audit_log. */
export async function appendPolicyAudit(entry: {
  walletId: string;
  kind: "policy.raise_requested" | "policy.change_applied" | "policy.raise_cancelled";
  actorType: "owner" | "system";
  actorId?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values(entry);
  } catch (err) {
    logger.error({ err, walletId: entry.walletId }, "policy.audit.failed");
  }
}

/** B4 + B9 — đề nghị NÂNG: email + hộp thư cho CHỦ VÍ (kèm chỉ dẫn huỷ) và
 * TỪNG GUARDIAN (lớp mắt thứ hai); SSE realtime cho banner/toast. */
export async function notifyRaiseRequested(input: {
  walletId: string;
  perTxLimit: bigint;
  dailyLimit: bigint;
}): Promise<void> {
  try {
    const [owner, guardianIds] = await Promise.all([
      ownerUserId(input.walletId),
      guardianUserIds(input.walletId),
    ]);
    const params = {
      perTx: formatXlmStroops(input.perTxLimit),
      daily: formatXlmStroops(input.dailyLimit),
      hours: Math.round(RAISE_DELAY_SECONDS / 3600),
      // Link HUỶ (B4) — email đi ngoài app nên phải tự chở đường về màn Cài đặt.
      // TRUSTED_ORIGINS[0] = origin FE chính (cùng nguồn CORS/CSRF tin cậy).
      link: `${env.TRUSTED_ORIGINS[0] ?? ""}/settings`,
    };
    if (owner) {
      for (const channel of CHANNELS) {
        await enqueueNotification({
          userId: owner,
          templateKey: "policy.raise_requested",
          params,
          channel,
        });
      }
      publishDomainEvent(owner, "policy.raise_requested");
    }
    for (const userId of guardianIds) {
      for (const channel of CHANNELS) {
        await enqueueNotification({
          userId,
          templateKey: "policy.raise_requested_guardian",
          params,
          channel,
        });
      }
      publishDomainEvent(userId, "policy.raise_requested");
    }
  } catch (err) {
    logger.error({ err, walletId: input.walletId }, "policy.notify.raise-requested.failed");
  }
}

/** B6/B7 — cron áp đề nghị sau 24h: email + SSE cho chủ ví. Email ở đây là lớp
 * an toàn thật: chủ ví bỏ lỡ thư đầu thì đây là tiếng chuông cuối trước khi
 * ngưỡng mới có hiệu lực. */
export async function notifyRaiseApplied(input: {
  walletId: string;
  perTxLimit: bigint;
  dailyLimit: bigint;
}): Promise<void> {
  try {
    const owner = await ownerUserId(input.walletId);
    if (!owner) return;
    const params = {
      perTx: formatXlmStroops(input.perTxLimit),
      daily: formatXlmStroops(input.dailyLimit),
    };
    for (const channel of CHANNELS) {
      await enqueueNotification({
        userId: owner,
        templateKey: "policy.raise_applied",
        params,
        channel,
      });
    }
    publishDomainEvent(owner, "policy.applied");
  } catch (err) {
    logger.error({ err, walletId: input.walletId }, "policy.notify.raise-applied.failed");
  }
}

/** B5/B7 — huỷ đề nghị: SSE cho chủ ví (banner biến mất realtime). */
export function notifyRaiseCancelled(ownerId: string): void {
  publishDomainEvent(ownerId, "policy.cancelled");
}
