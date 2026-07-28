import { describe, expect, it } from "vitest";
import { sanitizeRedirect } from "./redirect-param";

describe("sanitizeRedirect — chống open redirect, giữ đường nội bộ", () => {
  it("đường nội bộ có query (link mời guardian) đi qua NGUYÊN VẸN", () => {
    expect(sanitizeRedirect("/guardian/accept?token=abc123")).toBe(
      "/guardian/accept?token=abc123",
    );
  });

  it("URL tuyệt đối ra ngoài bị bỏ", () => {
    expect(sanitizeRedirect("https://evil.com/phish")).toBeUndefined();
  });

  it("protocol-relative //evil.com và /\\evil.com bị bỏ", () => {
    expect(sanitizeRedirect("//evil.com")).toBeUndefined();
    expect(sanitizeRedirect("/\\evil.com")).toBeUndefined();
  });

  it("thiếu / rỗng → undefined (rơi về postAuthPath)", () => {
    expect(sanitizeRedirect(undefined)).toBeUndefined();
    expect(sanitizeRedirect("")).toBeUndefined();
  });
});
