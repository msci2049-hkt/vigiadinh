// WHY: Test lõi pool-budget THUẦN — assertion fire đúng KHÔNG cần boot/stack.
// (assertPoolBudget bọc evaluate + logger + process.exit; test evaluate trực tiếp.)
import { describe, expect, test } from "bun:test";
import { evaluatePoolBudget } from "@/lib/pool-budget";

const base = { dbPoolMax: 20, pgMaxConnections: 100, hashMaxConcurrent: 2, cores: 8 };

describe("evaluatePoolBudget", () => {
  test("WEB=1 (default) → boot OK ((1+1)×20=40 ≤ 80)", () => {
    const r = evaluatePoolBudget({ ...base, webInstances: 1 });
    expect(r.dbConnections).toBe(40);
    expect(r.budget).toBe(80);
    expect(r.refuse).toBe(false);
  });

  test("WEB=4, pool=20 → REFUSE ((4+1)×20=100 > 80)", () => {
    const r = evaluatePoolBudget({ ...base, webInstances: 4 });
    expect(r.dbConnections).toBe(100);
    expect(r.refuse).toBe(true);
  });

  test("WEB=4, pool=10 → OK ((4+1)×10=50 ≤ 80)", () => {
    const r = evaluatePoolBudget({ ...base, webInstances: 4, dbPoolMax: 10 });
    expect(r.refuse).toBe(false);
  });

  test("hash over-commit → warning (WEB×HASH > 2×core)", () => {
    // WEB=10, hash=2, cores=8 → boxHash=20 > 16. pool nhỏ để không refuse trước.
    const r = evaluatePoolBudget({ ...base, webInstances: 10, dbPoolMax: 4, cores: 8 });
    expect(r.boxHash).toBe(20);
    expect(r.hashCeiling).toBe(16);
    expect(r.warnings.length).toBeGreaterThanOrEqual(1);
  });

  test("không warn khi hash trong ngưỡng (2×2=4 ≤ 16)", () => {
    const r = evaluatePoolBudget({ ...base, webInstances: 2, cores: 8 });
    expect(r.warnings).toHaveLength(0);
  });

  test("budget = floor(80% × max_connections)", () => {
    const r = evaluatePoolBudget({ ...base, webInstances: 1, pgMaxConnections: 200 });
    expect(r.budget).toBe(160);
  });
});
