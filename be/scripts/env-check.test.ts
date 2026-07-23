// Test env-check: pass / fail / missing-var / placeholder / parse file.
// Unit test hàm thuần (không spawn) + 2 case spawn CLI thật để chốt exit code.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requiredEnvKeys } from "../src/env.schema";
import { checkEnvRecord, parseEnvFile } from "./env-check";

/** Record env tối thiểu HỢP LỆ theo schema (mirror .env.example). */
function validRecord(): Record<string, string> {
  return {
    NODE_ENV: "development",
    DATABASE_URL: "postgres://app:app@localhost:5432/app",
    REDIS_URL: "redis://localhost:3699",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    TRUSTED_ORIGINS: "http://localhost:3000",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "noreply@example.com",
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
  };
}

describe("requiredEnvKeys", () => {
  test("chứa đúng các biến không có default/optional", () => {
    const keys = requiredEnvKeys();
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("REDIS_URL");
    expect(keys).toContain("BETTER_AUTH_SECRET");
    expect(keys).toContain("R2_BUCKET");
    // Có default → không nằm trong tập bắt buộc.
    expect(keys).not.toContain("PORT");
    expect(keys).not.toContain("NODE_ENV");
    expect(keys).not.toContain("SENTRY_DSN");
  });
});

describe("checkEnvRecord", () => {
  test("env đủ + hợp lệ → ok", () => {
    const result = checkEnvRecord(validRecord());
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);
  });

  test("thiếu 1 biến bắt buộc → fail, in đúng TÊN biến + lý do THIẾU", () => {
    const record = validRecord();
    delete (record as Record<string, string | undefined>).DATABASE_URL;
    const result = checkEnvRecord(record);
    expect(result.ok).toBe(false);
    const problem = result.problems.find((p) => p.key === "DATABASE_URL");
    expect(problem).toBeDefined();
    expect(problem?.reason).toContain("THIẾU");
  });

  test("biến = chuỗi rỗng → coi như THIẾU (emptyStringAsUndefined)", () => {
    const record = { ...validRecord(), REDIS_URL: "" };
    const result = checkEnvRecord(record);
    expect(result.ok).toBe(false);
    expect(result.problems.find((p) => p.key === "REDIS_URL")?.reason).toContain("THIẾU");
  });

  test("biến sai format → fail với message của schema", () => {
    const record = { ...validRecord(), BETTER_AUTH_SECRET: "ngắn" };
    const result = checkEnvRecord(record);
    expect(result.ok).toBe(false);
    expect(result.problems.find((p) => p.key === "BETTER_AUTH_SECRET")?.reason).toContain("32");
  });

  test("placeholder <...> → fail dù schema chỉ đòi min(1)", () => {
    const record = { ...validRecord(), RESEND_API_KEY: "<DÁN_VÀO_ĐÂY>" };
    const result = checkEnvRecord(record);
    expect(result.ok).toBe(false);
    expect(result.problems.find((p) => p.key === "RESEND_API_KEY")?.reason).toContain(
      "placeholder",
    );
  });

  test("scanAllKeysForPlaceholder: bắt placeholder cả biến infra ngoài schema", () => {
    const record = { ...validRecord(), POSTGRES_PASSWORD: "<DÁN_VÀO_ĐÂY>" };
    expect(checkEnvRecord(record).ok).toBe(true); // mặc định: bỏ qua key ngoài schema
    const strict = checkEnvRecord(record, { scanAllKeysForPlaceholder: true });
    expect(strict.ok).toBe(false);
    expect(strict.problems[0]?.key).toBe("POSTGRES_PASSWORD");
  });

  test("NODE_ENV=production được báo lại trong result (để in tập prod-required)", () => {
    const record = { ...validRecord(), NODE_ENV: "production" };
    delete (record as Record<string, string | undefined>).R2_BUCKET;
    const result = checkEnvRecord(record);
    expect(result.nodeEnv).toBe("production");
    expect(result.ok).toBe(false);
  });
});

describe("parseEnvFile", () => {
  test("bỏ comment, dòng trống, hỗ trợ export/quote/CRLF/comment inline", () => {
    const text = [
      "# comment",
      "",
      "PLAIN=abc",
      'QUOTED="gia tri"',
      "SINGLE='don'",
      "export EXPORTED=ok",
      "INLINE=value # ghi chú",
      "EMPTY=",
    ].join("\r\n");
    const parsed = parseEnvFile(text);
    expect(parsed.PLAIN).toBe("abc");
    expect(parsed.QUOTED).toBe("gia tri");
    expect(parsed.SINGLE).toBe("don");
    expect(parsed.EXPORTED).toBe("ok");
    expect(parsed.INLINE).toBe("value");
    expect(parsed.EMPTY).toBe("");
    expect(parsed["# comment"]).toBeUndefined();
  });
});

describe("CLI --env-file (spawn thật, chốt exit code)", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-check-"));

  function runCli(envFilePath: string): { exitCode: number; stderr: string; stdout: string } {
    const proc = Bun.spawnSync(["bun", "scripts/env-check.ts", "--env-file", envFilePath], {
      cwd: join(import.meta.dir, ".."),
    });
    return {
      exitCode: proc.exitCode,
      stderr: proc.stderr.toString(),
      stdout: proc.stdout.toString(),
    };
  }

  test("file đủ biến → exit 0", () => {
    const path = join(dir, "good.env");
    writeFileSync(
      path,
      Object.entries(validRecord())
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
    );
    const { exitCode, stdout } = runCli(path);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("✅");
  });

  test("file production thiếu biến + placeholder → exit 1, in tên biến", () => {
    const path = join(dir, "bad.env");
    // Thiếu DATABASE_URL/R2_*, BETTER_AUTH_URL là placeholder.
    writeFileSync(
      path,
      ["NODE_ENV=production", "REDIS_URL=redis://dragonfly:6379", "BETTER_AUTH_URL=<DOMAIN>"].join(
        "\n",
      ),
    );
    const { exitCode, stderr } = runCli(path);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("DATABASE_URL");
    expect(stderr).toContain("BETTER_AUTH_URL");
    expect(stderr).toContain("PROD-REQUIRED");
  });
});
