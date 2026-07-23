import { describe, expect, it } from "bun:test";
import { sumBps } from "../../infra/inheritance.repository";
import { heirInput } from "./dto";

describe("inheritance contract", () => {
  it("bps ngoài 0..10000 bị chặn", () => {
    expect(heirInput.safeParse({ heirRef: "G...", bps: 10001 }).success).toBe(false);
  });
  it("sumBps cộng đúng (service sẽ enforce tổng = 10000)", () => {
    expect(sumBps([{ bps: 6000 }, { bps: 4000 }])).toBe(10000);
  });
});
