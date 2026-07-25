// Cổng nghiệm thu 3.4 (A7): "thử UPDATE audit → bị chặn" — trên Postgres THẬT,
// trigger audit_log_no_update (migration 0002) chặn CẢ UPDATE lẫn DELETE.
import { describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { auditLog } from "./audit-log.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

// Drizzle bọc PostgresError — message thật nằm trong chuỗi err.cause.
const deepMessage = (err: unknown): string => {
  let out = "";
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    out += ` ${(cur as { message?: string }).message ?? ""}`;
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
};

describe("audit_log append-only (Postgres thật)", () => {
  testIt("INSERT được; UPDATE và DELETE bị trigger chặn", async () => {
    const [row] = await db
      .insert(auditLog)
      .values({
        walletId: `it-audit-${crypto.randomUUID().slice(0, 8)}`,
        kind: "test.append-only",
        actorType: "system",
        payload: { probe: true },
      })
      .returning({ id: auditLog.id });
    if (!row) throw new Error("audit insert failed");

    const expectAppendOnly = async (op: Promise<unknown>) => {
      try {
        await op;
        throw new Error("PHẢI bị trigger chặn nhưng đã chạy qua");
      } catch (err) {
        expect(deepMessage(err)).toContain("append-only");
      }
    };

    await expectAppendOnly(
      db.update(auditLog).set({ kind: "tampered" }).where(eq(auditLog.id, row.id)),
    );
    await expectAppendOnly(db.delete(auditLog).where(eq(auditLog.id, row.id)));

    // Dòng vẫn nguyên vẹn sau hai lần thử phá.
    const [after] = await db
      .select({ kind: auditLog.kind })
      .from(auditLog)
      .where(eq(auditLog.id, row.id));
    expect(after?.kind).toBe("test.append-only");
  });

  // B-SEC-4: trigger DÒNG (0002) KHÔNG bắn khi TRUNCATE — trigger STATEMENT-level
  // (0008) mới chặn được. Không có 0008 thì TRUNCATE xoá sạch nhật ký âm thầm.
  testIt("TRUNCATE bị trigger STATEMENT-level chặn (0008)", async () => {
    const [row] = await db
      .insert(auditLog)
      .values({
        walletId: `it-trunc-${crypto.randomUUID().slice(0, 8)}`,
        kind: "test.truncate-guard",
        actorType: "system",
        payload: { probe: true },
      })
      .returning({ id: auditLog.id });
    if (!row) throw new Error("audit insert failed");

    let blocked = false;
    try {
      await db.execute(sql`TRUNCATE audit_log`);
    } catch (err) {
      blocked = deepMessage(err).includes("append-only");
    }
    expect(blocked).toBe(true);

    // Mốc vẫn còn — TRUNCATE không xoá được một dòng nào.
    const [after] = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.id, row.id));
    expect(after?.id).toBe(row.id);
  });
});
