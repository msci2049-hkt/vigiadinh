// EventSource THẬT trên rpc.Server.getEvents (SDK 16 — cursor XOR startLedger,
// RESEARCH-LOG "getEvents semantics"). Parse ScVal ở RÌA này; lõi chỉ thấy
// SimplifiedEvent. Gap: checkpoint < oldestLedger của RPC (trôi quá cửa sổ ~7
// ngày) → báo gapFromLedger để lõi ghi audit lỗ hổng; cursor thối → fallback
// quét lại từ cửa sổ hiện tại (thà trùng — dedupe lo — còn hơn mất).
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";
import type { EventPage, EventSource, SimplifiedEvent } from "./indexer.service";

const PAGE_LIMIT = 100;
// Bootstrap lần đầu: quét lùi tối đa ~2h (1440 ledger × ~5s) — đủ nối liền nếu
// deploy mới; lịch sử sâu hơn thuộc về rebuild-from-state (PHA 5).
const BOOTSTRAP_LOOKBACK_LEDGERS = 1440;

function simplify(event: rpc.Api.EventResponse): SimplifiedEvent {
  let kind = "unknown";
  const topics: unknown[] = [];
  for (const t of event.topic) {
    try {
      topics.push(scValToNative(t));
    } catch {
      topics.push(t.toXDR("base64"));
    }
  }
  if (typeof topics[0] === "string") kind = topics[0];
  let value: unknown;
  try {
    value = scValToNative(event.value);
  } catch {
    value = event.value.toXDR("base64");
  }
  return {
    id: event.id,
    ledger: event.ledger,
    contractId: event.contractId?.contractId() ?? "",
    kind,
    data: { topics, value, txHash: event.txHash },
  };
}

export function rpcEventSource(config: { rpcUrl: string; contractIds: string[] }): EventSource {
  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const filters: rpc.Api.EventFilter[] = [{ type: "contract", contractIds: config.contractIds }];

  async function fetchFromLedger(startLedger: number): Promise<rpc.Api.GetEventsResponse> {
    return server.getEvents({ filters, startLedger, limit: PAGE_LIMIT });
  }

  return {
    async fetch(checkpoint): Promise<EventPage> {
      let response: rpc.Api.GetEventsResponse;
      let gapFromLedger: number | undefined;

      if (checkpoint.cursor) {
        try {
          response = await server.getEvents({
            filters,
            cursor: checkpoint.cursor,
            limit: PAGE_LIMIT,
          });
        } catch (err) {
          // Cursor thối (RPC trôi cửa sổ) — quét lại từ cửa sổ hiện có + báo gap.
          logger.warn({ err, cursor: checkpoint.cursor }, "indexer.cursor-stale");
          const latest = await server.getLatestLedger();
          const start = Math.max(1, latest.sequence - BOOTSTRAP_LOOKBACK_LEDGERS);
          response = await fetchFromLedger(start);
          gapFromLedger = start;
        }
      } else {
        const latest = await server.getLatestLedger();
        const start = Math.max(
          checkpoint.ledgerSeq || 1,
          latest.sequence - BOOTSTRAP_LOOKBACK_LEDGERS,
        );
        response = await fetchFromLedger(start);
      }

      return {
        events: response.events.map(simplify),
        cursor: response.cursor,
        latestLedger: response.latestLedger,
        ...(gapFromLedger !== undefined ? { gapFromLedger } : {}),
      };
    },
  };
}
