// GÁC preflight: mỗi header trong danh sách là một tính năng sống hay chết.
// Test hermetic (chỉ đọc hằng số, không boot app) — cố tình KHÔNG so cả mảng
// bằng toEqual: thêm header mới là việc bình thường, XOÁ header cũ mới là hồi quy.
import { describe, expect, it } from "bun:test";
import { CORS_ALLOW_HEADERS } from "./cors-headers";

const REQUIRED: Array<{ header: string; why: string }> = [
  { header: "Content-Type", why: "mọi POST JSON" },
  { header: "Authorization", why: "Bearer session (WebView/extension) + JWT ví SEP-45" },
  { header: "sentry-trace", why: "distributed trace FE→BE" },
  { header: "baggage", why: "distributed trace FE→BE" },
  { header: "x-client-name", why: "@stellar/stellar-sdk gắn vào mọi request /rpc" },
  { header: "x-client-version", why: "@stellar/stellar-sdk gắn vào mọi request /rpc" },
  { header: "last-event-id", why: "SSE reconnect — thiếu là realtime chết im lặng" },
];

describe("CORS_ALLOW_HEADERS", () => {
  for (const { header, why } of REQUIRED) {
    it(`cho phép ${header} (${why})`, () => {
      const lower = CORS_ALLOW_HEADERS.map((h) => h.toLowerCase());
      expect(lower).toContain(header.toLowerCase());
    });
  }

  it("không trùng lặp (trùng = ai đó thêm lại header đã có, dấu hiệu merge hỏng)", () => {
    const lower = CORS_ALLOW_HEADERS.map((h) => h.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
