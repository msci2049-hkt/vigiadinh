// LÔ 3 §5 — payload SSE domain KHÔNG được chở trường nhạy cảm: chỉ `type`
// (whitelist) + `label` hiển thị. Có ai vô tình nhét token/địa chỉ/hash vào
// helper là test này đỏ trước khi secret kịp chạm dây SSE.
import { beforeEach, describe, expect, it, mock } from "bun:test";

const published: Array<{ userId: string; event: string; data: unknown }> = [];
mock.module("@/lib/realtime", () => ({
  publishToUser: (userId: string, event: string, data: unknown) => {
    published.push({ userId, event, data });
    return "01TESTULID";
  },
}));

const { publishDomainEvent } = await import("./domain-events");

beforeEach(() => {
  published.length = 0;
});

describe("publishDomainEvent", () => {
  it("chỉ forward type + label, dưới event 'domain', đúng user", () => {
    publishDomainEvent("user-1", "guardian.accepted", { label: "Anh ba" });
    expect(published).toHaveLength(1);
    const evt = published[0];
    expect(evt?.userId).toBe("user-1");
    expect(evt?.event).toBe("domain");
    expect(evt?.data).toEqual({ type: "guardian.accepted", label: "Anh ba" });
  });

  it("không label → payload đúng một trường type", () => {
    publishDomainEvent("user-2", "intent.expired");
    expect(published[0]?.data).toEqual({ type: "intent.expired" });
  });

  it("payload không bao giờ chứa trường nhạy cảm (token/hash/địa chỉ)", () => {
    publishDomainEvent("user-3", "guardian.added", { label: "Mẹ" });
    const keys = Object.keys(published[0]?.data as Record<string, unknown>);
    expect(keys.sort()).toEqual(["label", "type"]);
    const serialized = JSON.stringify(published[0]?.data);
    // Không chuỗi nào có hình dạng địa chỉ Stellar (C/G + 55 ký tự base32).
    expect(serialized).not.toMatch(/[CG][A-Z2-7]{55}/);
  });
});
