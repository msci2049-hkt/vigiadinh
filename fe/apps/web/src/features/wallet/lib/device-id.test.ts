import { beforeEach, describe, expect, it } from "vitest";
import { getDeviceId } from "./device-id";

describe("device-id", () => {
  beforeEach(() => localStorage.clear());

  it("sinh UUID lần đầu và giữ ổn định các lần sau", () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(first);
  });

  it("persist qua localStorage (mô phỏng reload)", () => {
    const id = getDeviceId();
    expect(localStorage.getItem("fw.device-id")).toBe(id);
  });
});
