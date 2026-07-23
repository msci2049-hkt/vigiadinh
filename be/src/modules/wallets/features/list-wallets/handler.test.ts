// Test stub hermetic (không cần DB) — chốt contract dto. Test tích hợp
// Postgres thật thêm khi có logic (pattern pgReachable, xem test-support/pg.ts).
import { describe, expect, it } from "bun:test";
import { listWalletsQuery } from "./dto";

describe("wallets.list dto", () => {
  it("default limit 50", () => {
    expect(listWalletsQuery.parse({})).toEqual({ limit: 50 });
  });
  it("chặn limit > 100", () => {
    expect(listWalletsQuery.safeParse({ limit: 101 }).success).toBe(false);
  });
});
