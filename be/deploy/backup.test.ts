// Test retention logic của deploy/backup.sh (--prune-only, không đụng docker):
// file .sql.gz cũ hơn RETENTION_DAYS bị xoá, file mới + file KHÁC đuôi giữ nguyên.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runPrune(backupDir: string, retentionDays: string): number {
  const proc = Bun.spawnSync(["bash", "deploy/backup.sh", "--prune-only"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, BACKUP_DIR: backupDir, RETENTION_DAYS: retentionDays },
  });
  return proc.exitCode;
}

function fileAgedDays(dir: string, name: string, days: number): string {
  const path = join(dir, name);
  writeFileSync(path, "dummy");
  const t = (Date.now() - days * 24 * 3600 * 1000) / 1000;
  utimesSync(path, t, t);
  return path;
}

describe("backup.sh --prune-only (retention)", () => {
  test("xoá dump quá hạn, giữ dump mới + file khác đuôi", () => {
    const dir = mkdtempSync(join(tmpdir(), "backup-ret-"));
    const oldDump = fileAgedDays(dir, "proj-20260601-030000.sql.gz", 10);
    const newDump = fileAgedDays(dir, "proj-20260705-030000.sql.gz", 1);
    const notDump = fileAgedDays(dir, "ghi-chu-cu.txt", 30); // khác đuôi — không đụng

    expect(runPrune(dir, "7")).toBe(0);

    expect(existsSync(oldDump)).toBe(false);
    expect(existsSync(newDump)).toBe(true);
    expect(existsSync(notDump)).toBe(true);
  });

  test("BACKUP_DIR chưa tồn tại → exit 0 (cron chạy trước backup đầu không gãy)", () => {
    expect(runPrune(join(tmpdir(), "khong-ton-tai-xyz"), "7")).toBe(0);
  });
});
