// Helper test cho indexer — fake EventSource trả trang theo thứ tự gọi.
import type { EventPage, EventSource, SimplifiedEvent } from "./indexer.service";

export function makeEvent(kind: string): SimplifiedEvent {
  return {
    id: `ev-${crypto.randomUUID()}`,
    ledger: Math.floor(Math.random() * 1000) + 1,
    contractId: `C${"A".repeat(55)}`,
    kind,
    data: { probe: true },
  };
}

/** Trang thứ i cho lần gọi thứ i (offset để test resume giữa chừng). */
export function fakeSource(pages: EventPage[], startAt = 0): EventSource {
  let call = startAt;
  return {
    async fetch() {
      const page = pages[Math.min(call, pages.length - 1)];
      call++;
      if (!page) throw new Error("fakeSource: không còn trang");
      return page;
    },
  };
}

export function checkpointOf(cursor: string | null, ledgerSeq: number) {
  return { cursor, ledgerSeq };
}
