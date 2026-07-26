// WHY: 3 lỗ hạ tầng đã làm sập deploy thật hoặc mở quyền owner cho app. Cả ba đều
// nằm trong file KHÔNG được typecheck/lint phủ (Dockerfile, deploy.sh, file env mẫu)
// nên chỉ có test đọc-nội-dung mới giữ được. Test này fail trên bản trước bản vá.
import { describe, expect, test } from "bun:test";

const read = async (rel: string) => await Bun.file(new URL(rel, import.meta.url)).text();

describe("Dockerfile — mọi `bun install` phải --ignore-scripts", () => {
  // Lỗ thật: stage `prod-deps` chạy `bun install --production` KHÔNG có
  // --ignore-scripts. `--production` bỏ devDependencies (lefthook nằm đó) nhưng
  // script `prepare: lefthook install` VẪN chạy → `command not found` → exit 127
  // → `docker build` FAIL. Stage `deps` đã có cờ này từ trước (BUG-013, lý do khác:
  // node-gyp) → repo biết footgun, chỉ sót đúng một dòng.
  test("không còn dòng `bun install` nào thiếu --ignore-scripts", async () => {
    const lines = (await read("../Dockerfile"))
      .split("\n")
      .filter((l) => l.includes("bun install") && !l.trimStart().startsWith("#"));

    expect(lines.length).toBeGreaterThan(0); // sanity: đọc đúng file
    const offenders = lines.filter((l) => !l.includes("--ignore-scripts"));
    expect(offenders).toEqual([]);
  });
});

describe("deploy.sh — owner URL chỉ vào container ephemeral", () => {
  // Lỗ thật: `compose run --rm app bun ./dist/migrate.js` không nhận
  // DATABASE_URL_OWNER, nên cách duy nhất để migrate chạy được là nhét owner URL
  // vào .env.production — mà file đó là `env_file:` của service app/worker chạy
  // 24/7. App giữ credential owner = một lỗ RCE leo lên role sở hữu bảng, và tầng
  // REVOKE UPDATE/DELETE/TRUNCATE trên audit_log (migration 0009) mất sạch tác dụng
  // vì owner bypass mọi GRANT.
  test("mọi `compose run --rm` bơm DATABASE_URL_OWNER qua -e", async () => {
    const runs = (await read("./deploy.sh"))
      .split("\n")
      .filter((l) => l.includes("compose run --rm") && !l.trimStart().startsWith("#"));

    expect(runs.length).toBe(3); // migrate --dry-run, migrate, provision-runtime-role
    for (const line of runs) {
      expect(line).toContain('-e DATABASE_URL_OWNER="$OWNER_URL"');
    }
  });

  test("owner URL đọc từ .env.migrate và FAIL-CLOSED khi thiếu", async () => {
    const sh = await read("./deploy.sh");
    expect(sh).toContain('MIGRATE_ENV="deploy/.env.migrate"');
    // Thiếu owner URL phải DỪNG deploy, không được im lặng chạy tiếp bằng
    // DATABASE_URL runtime (role đó không có DDL → migrate gãy giữa chừng).
    expect(sh).toMatch(/\[ -n "\$OWNER_URL" \] \|\| \{[^}]*exit 1/);
  });

  test("env.production.example KHÔNG khai DATABASE_URL_OWNER ở dạng active", async () => {
    const active = (await read("./env.production.example"))
      .split("\n")
      .filter((l) => /^\s*DATABASE_URL_OWNER\s*=/.test(l));
    expect(active).toEqual([]);
  });

  test("env.migrate.example tồn tại và chỉ khai đúng owner URL", async () => {
    const active = (await read("./env.migrate.example"))
      .split("\n")
      .filter((l) => /^\s*[A-Z_][A-Z0-9_]*\s*=/.test(l))
      .map((l) => l.split("=")[0].trim());
    expect(active).toEqual(["DATABASE_URL_OWNER"]);
  });
});

describe("R2 đã gỡ khỏi env (B-ENV-1)", () => {
  // Lỗ thật: R2_* xếp cùng mức bắt buộc như DATABASE_URL nhưng 0 consumer
  // production → mọi deploy phải bịa `dummy_chua_dung_r2` để boot qua GATE env:check.
  test("không file env mẫu nào còn khai R2_* dạng active", async () => {
    for (const f of ["./env.production.example", "../.env.example"]) {
      const active = (await read(f)).split("\n").filter((l) => /^\s*R2_[A-Z_]*\s*=/.test(l));
      expect(active).toEqual([]);
    }
  });
});
