import { describe, expect, it } from "bun:test";
import { guardianStatusEnum, walletIdParam } from "../../domain/validators";

describe("guardians validators", () => {
  it("status enum khớp CHECK constraint", () => {
    expect(guardianStatusEnum.options).toEqual(["invited", "active", "slow", "offline", "removed"]);
  });
  it("walletId phải là ULID 26 ký tự", () => {
    expect(walletIdParam.safeParse({ walletId: "x" }).success).toBe(false);
  });
});
