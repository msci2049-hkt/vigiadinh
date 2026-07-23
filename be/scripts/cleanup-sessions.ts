// WHY: Dọn session + verification token đã hết hạn. Better Auth check expiresAt
// runtime nên row cũ không gây lỗi, nhưng để lâu sẽ làm bảng phình + chậm
// query. Chạy daily.
//
// Local: bun run auth:cleanup
// Production cron: 0 3 * * * cd /var/www/app && bun scripts/cleanup-sessions.ts
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logger";

async function cleanup(): Promise<void> {
  const sessionResult = await db.execute(
    sql`DELETE FROM "session" WHERE expires_at < NOW() - INTERVAL '1 day'`,
  );
  const verifResult = await db.execute(
    sql`DELETE FROM verification WHERE expires_at < NOW() - INTERVAL '1 day'`,
  );
  logger.info(
    {
      sessions: sessionResult.count ?? 0,
      verifications: verifResult.count ?? 0,
    },
    "auth.cleanup.done",
  );
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "auth.cleanup.failed");
    process.exit(1);
  });
