// WHY: Hạ tầng GENERIC cho test integration chạy trên Postgres THẬT:
//   - pgReachable(): DB có sẵn không → test SKIP (nêu lý do), KHÔNG giả vờ pass.
//   - pgErrorCode(): đi chuỗi err.cause lấy mã PG thật (Drizzle bọc PostgresError).
// Dùng client/db dùng chung (@/db) để test đúng cơ chế thật (FOR UPDATE, ON
// CONFLICT, advisory lock) như production.
import { client } from "@/db";

let cached: boolean | null = null;

/** Postgres thật có kết nối được không (cache). false → integration test SKIP. */
export async function pgReachable(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    await client`SELECT 1`;
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}

export const SKIP_REASON =
  "[skip] Postgres không sẵn sàng — bật stack Docker của repo NÀY (xem docker-compose*.yml) rồi chạy bun run db:migrate";

// Drizzle BỌC PostgresError → mã 23xxx nằm ở err.cause, KHÔNG phải top-level.
// Đi theo chuỗi cause để lấy mã PG thật.
export function pgErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string") return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
