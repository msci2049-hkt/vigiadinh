// Lõi indexer (PHA 4.2): xử lý MỖI BATCH trong MỘT transaction —
//   dedupe (PK event id, conflict = bỏ) → áp mirror + notify → checkpoint.
// Kill BẤT KỲ đâu giữa batch = tx rollback = checkpoint không nhích → restart
// refetch đúng batch đó, không mất; đã commit rồi mà RPC trả trùng trang sau →
// PK conflict bỏ qua, không trùng. (Audit kill-restart có test integration.)
// Nguồn event tiêm qua port EventSource — RPC thật ở rpc-source.ts, test tiêm fake.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { enqueueNotificationTx } from "@/modules/notifications";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { orderByPriority, routeEvent } from "../domain/event-router";
import { toJsonSafe } from "../domain/json-safe";
import { auditLog } from "./audit-log.schema";
import { indexerCheckpoint, indexerEvents } from "./checkpoint.schema";
import { notifyGuardiansRecoveryClosed } from "./recovery-closed-notify";

export const DEFAULT_STREAM = "default";

/** Event đã giản lược — nguồn RPC parse ScVal ở rìa, lõi không đụng XDR. */
export type SimplifiedEvent = {
  id: string;
  ledger: number;
  contractId: string;
  kind: string;
  data: Record<string, unknown>;
};

export type EventPage = {
  events: SimplifiedEvent[];
  cursor: string;
  latestLedger: number;
  /** RPC đã trôi quá cửa sổ giữ event (checkpoint < oldestLedger) — có lỗ hổng. */
  gapFromLedger?: number;
};

export type EventSource = {
  fetch(checkpoint: { cursor: string | null; ledgerSeq: number }): Promise<EventPage>;
};

export async function getCheckpoint(
  streamId: string = DEFAULT_STREAM,
): Promise<{ cursor: string | null; ledgerSeq: number }> {
  const [row] = await db.select().from(indexerCheckpoint).where(eq(indexerCheckpoint.id, streamId));
  return row ? { cursor: row.cursor, ledgerSeq: row.ledgerSeq } : { cursor: null, ledgerSeq: 0 };
}

/** Chạy MỘT vòng poll: fetch → áp batch atomically. Trả số event MỚI đã áp. */
export async function pollOnce(
  source: EventSource,
  streamId: string = DEFAULT_STREAM,
): Promise<number> {
  const checkpoint = await getCheckpoint(streamId);
  const page = await source.fetch(checkpoint);

  let applied = 0;
  await db.transaction(async (tx) => {
    // Lỗ hổng sự kiện (sập quá cửa sổ RPC): THỪA NHẬN bằng audit, cấm đoán lấp
    // (pipeline §4) — mirror dựng lại từ state hiện tại là việc PHA 5 khi có
    // contract nghiệp vụ; ở đây ghi hồ sơ lỗ hổng ledger X→Y rồi chạy tiếp.
    if (page.gapFromLedger !== undefined && checkpoint.ledgerSeq > 0) {
      await tx.insert(auditLog).values({
        walletId: "system",
        kind: "indexer.gap",
        actorType: "system",
        payload: { fromLedger: checkpoint.ledgerSeq, toLedger: page.gapFromLedger },
      });
    }

    for (const event of orderByPriority(page.events)) {
      const inserted = await tx
        .insert(indexerEvents)
        .values({
          id: event.id,
          ledger: event.ledger,
          contractId: event.contractId,
          kind: event.kind,
          payload: event.data,
        })
        .onConflictDoNothing()
        .returning({ id: indexerEvents.id });
      if (inserted.length === 0) continue; // đã xử lý trước đó (trang trùng) — bỏ

      await applyEvent(tx, event);
      applied++;
    }

    await tx
      .insert(indexerCheckpoint)
      .values({ id: streamId, cursor: page.cursor, ledgerSeq: page.latestLedger })
      .onConflictDoUpdate({
        target: indexerCheckpoint.id,
        set: { cursor: page.cursor, ledgerSeq: page.latestLedger, updatedAt: sql`now()` },
      });
  });
  return applied;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ví của event: registry (walletFromTopic) → topics[1] = địa chỉ ví; còn lại →
 * contractId (ví smart-account có contract riêng). */
async function findWallet(tx: Tx, event: SimplifiedEvent, walletFromTopic: boolean) {
  const query = tx
    .select({
      id: wallets.id,
      ownerUserId: wallets.userId,
      threshold: wallets.threshold,
      timelockSecs: wallets.timelockSecs,
    })
    .from(wallets);
  if (walletFromTopic) {
    const topics = (event.data as { topics?: unknown[] }).topics;
    const address = topics?.[1];
    if (typeof address !== "string") return undefined;
    const [row] = await query.where(eq(wallets.stellarAddress, address));
    return row;
  }
  const [row] = await query.where(eq(wallets.contractId, event.contractId));
  return row;
}

type MirrorWallet = NonNullable<Awaited<ReturnType<typeof findWallet>>>;

/** Trạng thái mirror còn "sống" — mọi cập nhật registry chỉ chạm các dòng này. */
const ACTIVE_MIRROR = inArray(recoveryRequests.status, ["pending", "ready"]);

/** Mirror registry (PHA 5.2) — nguồn sự thật = chain, indexer là NGƯỜI GHI DUY NHẤT
 * của recovery_requests (route ghi chỉ audit). Idempotent nhờ dedupe PK event id.
 * Trả `true` khi event vừa ĐÓNG một yêu cầu đang mở (cancel/finalize chạm dòng
 * active thật) — R5: đó là lúc phải báo mọi guardian, replay/event mồ côi thì không. */
async function applyRegistryMirror(
  tx: Tx,
  kind: string,
  wallet: MirrorWallet,
  event: SimplifiedEvent,
): Promise<boolean> {
  const data = event.data as { value?: unknown; txHash?: unknown };
  const walletScope = eq(recoveryRequests.walletId, wallet.id);
  switch (kind) {
    case "initiate": {
      // Registry v2: value = (initiator Address, fingerprint sha256 của Signer mới).
      // newOwner (varchar 56) lưu fingerprint hex CẮT 56 ký tự (28B — đủ đối chiếu
      // UI/audit; khoá đầy đủ nằm on-chain qua get_recovery_status). vetoUntil ƯỚC
      // LƯỢNG từ mirror timelock ví (mốc chuẩn = started_at contract).
      const value = data.value;
      if (!Array.isArray(value)) return false;
      const fp = value[1];
      if (!(fp instanceof Uint8Array)) return false;
      const initiator = typeof value[0] === "string" ? value[0] : null;
      const txHash = typeof data.txHash === "string" ? data.txHash.slice(0, 64) : null;
      await tx.insert(recoveryRequests).values({
        walletId: wallet.id,
        newOwner: Buffer.from(fp).toString("hex").slice(0, 56),
        status: "pending",
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
      return false;
    }
    case "approve": {
      // value = (guardian, approvals_len) → native [string, number].
      const value = data.value;
      const approvalsLen = Array.isArray(value) ? Number(value[1]) : Number.NaN;
      if (!Number.isFinite(approvalsLen)) return false;
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
      return false;
    }
    case "cancel": {
      const closed = await tx
        .update(recoveryRequests)
        .set({ status: "vetoed" })
        .where(and(walletScope, ACTIVE_MIRROR))
        .returning({ id: recoveryRequests.id });
      return closed.length > 0;
    }
    case "finalize": {
      const closed = await tx
        .update(recoveryRequests)
        .set({ status: "executed" })
        .where(and(walletScope, ACTIVE_MIRROR))
        .returning({ id: recoveryRequests.id });
      return closed.length > 0;
    }
    default:
      return false;
  }
}

/** Áp MỘT event: mirror + audit (+ notify chủ ví nếu template có). */
async function applyEvent(tx: Tx, event: SimplifiedEvent): Promise<void> {
  const route = routeEvent(event.kind);
  const wallet = await findWallet(tx, event, route.walletFromTopic === true);

  // Mirror: event registry on-chain (initiate/approve/cancel/finalize) + veto pipeline
  // (recovery.vetoed) — veto đứng ĐẦU batch nhờ orderByPriority. Invalidate
  // session/device-proof nối ở PHA 6 (TODO có chủ đích, ghi BUILD-LOG).
  // R5: `closedRecovery` = event này vừa ĐÓNG một yêu cầu đang mở thật —
  // lúc đó phải báo MỌI guardian (kể cả người chưa duyệt), không chỉ chủ ví.
  let closedRecovery = false;
  if (wallet) {
    if (route.walletFromTopic) {
      closedRecovery = await applyRegistryMirror(tx, route.kind, wallet, event);
    } else if (route.kind === "recovery.vetoed") {
      const closed = await tx
        .update(recoveryRequests)
        .set({ status: "vetoed" })
        .where(eq(recoveryRequests.walletId, wallet.id))
        .returning({ id: recoveryRequests.id });
      closedRecovery = closed.length > 0;
    }
  }

  await tx.insert(auditLog).values({
    // walletId varchar(26) — contract chưa khớp ví nào dùng sentinel, contract
    // thật nằm trong payload (audit soft-ref, không FK — rule db-schema).
    walletId: wallet?.id ?? "unmatched",
    kind: route.known ? event.kind : `unknown:${event.kind}`,
    actorType: "system",
    payload: {
      eventId: event.id,
      ledger: event.ledger,
      contractId: event.contractId,
      data: event.data,
    },
  });

  if (route.notifyTemplate && wallet) {
    const params = { walletId: wallet.id, eventId: event.id, ...event.data };
    if (route.notifyTemplate.startsWith("recovery.")) {
      // recovery.* = sự kiện AN NINH → email + sse, KHÔNG push. Push chưa cấu
      // hình (dispatcher ném PermanentDispatchError PUSH_NOT_CONFIGURED) —
      // enqueue push cho đường khôi phục là enqueue vào hư không (sự cố 30/07,
      // tái diễn 31/07 với recovery.initiated). Bộ kênh CỐ Ý trùng
      // RECOVERY_NOTIFY_CHANNELS của recovery.repository.ts (không import chéo
      // module — luật module-boundary); indexer.integration.test.ts khoá cả 5
      // template recovery.* ở mức DB. Nút veto từ email nối ở PHA 5.
      for (const channel of ["email", "sse"] as const) {
        await enqueueNotificationTx(tx, {
          userId: wallet.ownerUserId,
          templateKey: route.notifyTemplate,
          params,
          channel,
        });
      }
    } else {
      await enqueueNotificationTx(tx, {
        userId: wallet.ownerUserId,
        templateKey: route.notifyTemplate,
        params,
        // Literal "push" CỐ Ý để tripwire notify-channels.test.ts còn thấy file
        // này — nhánh trên đã chặn mọi template recovery.* rơi vào đây.
        channel: "push",
      });
    }
  }

  // R5 nhóm A: lệnh khôi phục vừa ĐÓNG thật (huỷ/veto/finalize chạm dòng đang
  // mở) → báo MỌI guardian của ví + audit — chủ ví đã nhận recovery.vetoed/
  // finalized ở nhánh trên, guardian nhận bản TIN TỐT recovery.closed.
  if (closedRecovery && wallet) {
    await notifyGuardiansRecoveryClosed(tx, {
      walletId: wallet.id,
      eventId: event.id,
      closedBy: route.kind,
    });
  }
}
