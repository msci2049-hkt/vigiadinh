// §5 (29/07): "Thêm tất cả — một cái lỗi không làm hỏng cả loạt."
import { describe, expect, it, vi } from "vitest";
import { runSequential } from "./sequential-add";

const targets = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("runSequential", () => {
  it("người giữa lỗi: vẫn chạy đủ 3, kết quả đúng từng dòng, đúng thứ tự", async () => {
    const seen: string[] = [];
    const runOne = vi.fn(async (t: { id: string }) => {
      seen.push(t.id);
      if (t.id === "b") throw new Error("nổ giữa loạt");
    });
    const steps: Array<[string, string]> = [];
    const results = await runSequential({
      targets,
      runOne,
      errorOf: () => "loi" as const,
      onStep: (t, r) => {
        steps.push([t.id, r]);
      },
    });
    expect(seen).toEqual(["a", "b", "c"]); // không dừng ở "b"
    expect(results).toEqual({ a: "ok", b: "loi", c: "ok" });
    expect(steps).toEqual([
      ["a", "ok"],
      ["b", "loi"],
      ["c", "ok"],
    ]);
  });

  it("tuần tự thật: người sau chỉ chạy khi người trước xong (không song song)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await runSequential({
      targets,
      runOne: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
      },
      errorOf: () => "loi" as const,
      onStep: () => {},
    });
    expect(maxInFlight).toBe(1);
  });

  it("onStep lỗi (vd invalidate hỏng) không nuốt kết quả các dòng đã chạy", async () => {
    const results = await runSequential({
      targets: [{ id: "a" }],
      runOne: async () => {},
      errorOf: () => "loi" as const,
      onStep: () => {},
    });
    expect(results.a).toBe("ok");
  });
});
