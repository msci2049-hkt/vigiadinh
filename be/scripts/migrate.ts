// WHY: Migrate GATE cho production (+ entry chuẩn `bun run db:migrate` cho dev).
// CƠ CHẾ DUY NHẤT: journal Drizzle (`drizzle/meta/_journal.json`) + bảng tracking
// `drizzle.__drizzle_migrations` (drizzle-orm migrator tự quản). KHÔNG có cơ chế
// schema_migrations song song — journal commit trong repo là nguồn sự thật;
// apply THẬT vẫn qua `migrate()` của drizzle-orm (đúng semantics
// statement-breakpoint), phần này chỉ THÊM: pending-detection + --dry-run +
// báo cáo đúng FILE nào gãy khi fail (gate deploy.sh cần biết dừng vì đâu).
//
// - Advisory lock: chống 2 instance CI/rolling deploy migrate cùng lúc.
// - Connection RIÊNG max:1, KHÔNG import app/@/env — CI/CD chỉ cần DATABASE_URL.
// - `--dry-run`: liệt kê migration pending rồi thoát 0 (KHÔNG apply, KHÔNG lock).
// - Fail: exit 1 + in tag file SQL đang apply dở (deploy.sh DỪNG, không up app).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export type JournalEntry = { idx: number; when: number; tag: string };

/** Parse drizzle/meta/_journal.json — validate tối thiểu, sort theo idx. */
export function parseJournal(json: unknown): JournalEntry[] {
  const entries = (json as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    throw new Error("_journal.json không có mảng entries — drizzle/meta hỏng?");
  }
  return entries
    .map((e) => {
      const { idx, when, tag } = e as Partial<JournalEntry>;
      if (typeof idx !== "number" || typeof when !== "number" || typeof tag !== "string") {
        throw new Error(`_journal.json entry hỏng: ${JSON.stringify(e)}`);
      }
      return { idx, when, tag };
    })
    .sort((a, b) => a.idx - b.idx);
}

/** Pending = entry có `when` MỚI HƠN migration cuối đã apply (logic của chính
 * drizzle migrator: so folderMillis với created_at cuối trong bảng tracking).
 * lastAppliedMillis = null → chưa từng migrate → pending toàn bộ. */
export function computePending(
  entries: JournalEntry[],
  lastAppliedMillis: number | null,
): JournalEntry[] {
  if (lastAppliedMillis === null) return entries;
  return entries.filter((e) => e.when > lastAppliedMillis);
}

/** Tìm file SQL gãy: drizzle migrator chạy CẢ BATCH trong 1 transaction (fail =
 * rollback hết, verify thật 2026-07) → không suy được từ bảng tracking. Dò bằng
 * fragment câu query fail (DrizzleQueryError message "Failed query: <sql>")
 * trong nội dung từng file pending. */
export function extractQueryFragment(message: string): string | null {
  const m = message.match(/Failed query:\s*(.+)/);
  const frag = m?.[1]?.trim();
  return frag && frag.length >= 8 ? frag : null;
}

async function findBrokenTag(pending: JournalEntry[], err: unknown): Promise<string | null> {
  const frag = extractQueryFragment((err as Error).message ?? "");
  if (!frag) return null;
  for (const e of pending) {
    const content = await Bun.file(`./drizzle/${e.tag}.sql`)
      .text()
      .catch(() => "");
    if (content.includes(frag)) return e.tag;
  }
  return null;
}

/** created_at của migration cuối đã apply; null nếu bảng tracking chưa tồn tại
 * (42P01) hoặc rỗng — nghĩa là DB chưa từng migrate. */
async function lastApplied(sql: postgres.Sql): Promise<number | null> {
  try {
    const rows = await sql<{ created_at: string | number | null }[]>`
      SELECT created_at FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC LIMIT 1`;
    const v = rows[0]?.created_at;
    return v == null ? null : Number(v);
  } catch (err) {
    if ((err as { code?: string }).code === "42P01") return null; // bảng chưa có
    throw err;
  }
}

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("[migrate] ❌ DATABASE_URL is required");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  // onnotice: nuốt NOTICE "already exists, skipping" (drizzle tạo schema tracking
  // idempotent) — giữ output gate sạch, chỉ còn dòng PENDING/OK/FAILED.
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    // Bundle prod chạy từ /app (dist/migrate.js) — journal ở ./drizzle như dev.
    const journal = parseJournal(await Bun.file("./drizzle/meta/_journal.json").json());
    const pending = computePending(journal, await lastApplied(sql));

    if (pending.length === 0) {
      console.log(`[migrate] ✅ Không có migration pending (${journal.length} đã apply đủ).`);
      return;
    }
    console.log(`[migrate] ${pending.length} migration PENDING:`);
    for (const e of pending) console.log(`  → ${e.tag}.sql`);
    if (dryRun) {
      console.log("[migrate] --dry-run: KHÔNG apply. Bỏ flag để chạy thật.");
      return;
    }

    console.log("[migrate] Acquiring advisory lock...");
    await sql`SELECT pg_advisory_lock(hashtext('drizzle-migrate'))`;
    try {
      const start = Date.now();
      // Apply qua drizzle migrator (đúng semantics breakpoint/transaction).
      await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
      console.log(
        `[migrate] ✅ Applied ${pending.length} migration trong ${Date.now() - start}ms.`,
      );
    } catch (err) {
      const broken = (await findBrokenTag(pending, err)) ?? pending[0]?.tag ?? "(không xác định)";
      console.error(`[migrate] ❌ FAILED tại file: ${broken}.sql`);
      console.error("[migrate] Toàn bộ batch đã ROLLBACK — DB giữ nguyên trạng thái trước gate.");
      console.error(`[migrate] ${(err as Error).message}`);
      process.exit(1);
    } finally {
      await sql`SELECT pg_advisory_unlock(hashtext('drizzle-migrate'))`.catch(() => {});
    }
  } catch (err) {
    console.error("[migrate] ❌ FAILED:", (err as Error).message);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

if (import.meta.main) {
  await main();
}
