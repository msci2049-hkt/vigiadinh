// Lõi indexer (PHA 4.2): xử lý MỖI BATCH trong MỘT transaction —
//   dedupe (PK event id, conflict = bỏ) → áp mirror + notify → checkpoint.
// Kill BẤT KỲ đâu giữa batch = tx rollback = checkpoint không nhích → restart
// refetch đúng batch đó, không mất; đã commit rồi mà RPC trả trùng trang sau →
// PK conflict bỏ qua, không trùng. (Audit kill-restart có test integration.)
// Nguồn event tiêm qua port EventSource — RPC thật ở rpc-source.ts, test tiêm fake.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { enqueueNotificationTx } from "@/modules/notifications";
import { recoveryRequests } from "../../recovery/infra/recovery-requests.schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { orderByPriority, routeEvent } from "../domain/event-router";
import { auditLog } from "./audit-log.schema";
import { indexerCheckpoint, indexerEvents } from "./checkpoint.schema";

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

/** Áp MỘT event: mirror + audit (+ notify chủ ví nếu template có). */
async function applyEvent(tx: Tx, event: SimplifiedEvent): Promise<void> {
  const route = routeEvent(event.kind);
  const [wallet] = await tx
    .select({ id: wallets.id, ownerUserId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.contractId, event.contractId));

  // Mirror riêng cho veto — ƯU TIÊN CAO NHẤT: request về 'vetoed' NGAY trong batch
  // (đứng đầu nhờ orderByPriority). Invalidate session/device-proof nối ở PHA 5
  // khi luồng recovery ghi thật (TODO có chủ đích, ghi BUILD-LOG).
  if (route.kind === "recovery.vetoed" && wallet) {
    await tx
      .update(recoveryRequests)
      .set({ status: "vetoed" })
      .where(eq(recoveryRequests.walletId, wallet.id));
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
    await enqueueNotificationTx(tx, {
      userId: wallet.ownerUserId,
      templateKey: route.notifyTemplate,
      params: { walletId: wallet.id, eventId: event.id, ...event.data },
      channel: "push",
    });
  }
}
