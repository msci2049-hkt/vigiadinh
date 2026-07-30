// GÁC A5 (sự cố 2026-07-30): indexer chết 48 phút mà KHÔNG một dòng log ứng dụng
// nào — nguyên nhân chỉ moi được từ `failedReason` trong BullMQ. Test này khoá
// cái tiếng nói đó lại: vòng poll chết PHẢI log `indexer.poll-failed` kèm
// checkpoint đang xử lý + nguyên văn lỗi, VÀ vẫn ném lại (fail-closed).
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logger";
import type { EventSource } from "@/modules/indexer";
import { indexerCheckpoint } from "@/modules/indexer/infra/checkpoint.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { runIndexerPollTick } from "./indexer-poll";

const dbUp = await pgReachable();
const testIt = dbUp ? test : test.skip;
if (!dbUp) console.warn(SKIP_REASON);

// Stream RIÊNG cho test — không đụng checkpoint "default" của máy dev.
const STREAM = `it-poll-${crypto.randomUUID().slice(0, 8)}`;

afterAll(async () => {
  if (!dbUp) return;
  // KHÔNG `client.end()` ở đây: bun test chạy nhiều file trong CÙNG process, đóng
  // pool dùng chung là các file sau đỏ giả với CONNECTION_ENDED.
  await db.delete(indexerCheckpoint).where(eq(indexerCheckpoint.id, STREAM));
});

/** Nguồn event vỡ — đúng hình dạng lỗi thật: throw ngay trong fetch/áp batch. */
function brokenSource(message: string): EventSource {
  return {
    async fetch() {
      throw new Error(message);
    },
  };
}

describe("runIndexerPollTick — chết thì phải NÓI RA", () => {
  testIt("lỗi vòng poll → logger.error có checkpoint + nguyên văn lỗi, rồi ném lại", async () => {
    const spy = spyOn(logger, "error");
    spy.mockClear();
    const boom = "JSON.stringify cannot serialize BigInt";

    await expect(runIndexerPollTick(brokenSource(boom), STREAM)).rejects.toThrow(boom);

    const call = spy.mock.calls.find((c) => c[1] === "indexer.poll-failed");
    expect(call, "không có dòng log nào cho indexer.poll-failed").toBeDefined();
    const fields = call?.[0] as {
      reason?: string;
      checkpoint?: { cursor: string | null; ledgerSeq: number };
    };
    // Nguyên văn lỗi — không phải "indexer failed" chung chung.
    expect(fields.reason).toBe(boom);
    // Checkpoint ĐANG xử lý: không có con số này thì log vô dụng để dựng lại ca lỗi.
    expect(fields.checkpoint).toBeDefined();
    expect(typeof fields.checkpoint?.ledgerSeq).toBe("number");
    spy.mockRestore();
  });

  testIt("vòng poll rỗng (không event mới) → KHÔNG log ồn, trả 0", async () => {
    const errSpy = spyOn(logger, "error");
    const infoSpy = spyOn(logger, "info");
    errSpy.mockClear();
    infoSpy.mockClear();

    const empty: EventSource = {
      async fetch(checkpoint) {
        return { events: [], cursor: checkpoint.cursor ?? "", latestLedger: checkpoint.ledgerSeq };
      },
    };
    expect(await runIndexerPollTick(empty, STREAM)).toBe(0);
    expect(errSpy.mock.calls.some((c) => c[1] === "indexer.poll-failed")).toBe(false);
    expect(infoSpy.mock.calls.some((c) => c[1] === "indexer.applied")).toBe(false);
    errSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
