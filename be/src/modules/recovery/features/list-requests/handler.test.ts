import { describe, expect, it } from "bun:test";
import { recoveryStatusEnum } from "../../domain/validators";

describe("recovery validators", () => {
  it("status enum khớp CHECK constraint", () => {
    expect(recoveryStatusEnum.options).toEqual([
      "pending",
      "ready",
      "executed",
      "vetoed",
      "expired",
    ]);
  });
  it("không có trạng thái cancel-bởi-risk (risk chỉ trì hoãn)", () => {
    expect(recoveryStatusEnum.options.some((s) => s.includes("cancel"))).toBe(false);
  });
});
