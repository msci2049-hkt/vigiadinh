// Test router hermetic: veto đứng ĐẦU mọi batch, unknown vẫn được giữ (không notify).
import { describe, expect, it } from "bun:test";
import { orderByPriority, routeEvent } from "./event-router";

describe("event router", () => {
  it("recovery.vetoed ưu tiên 0 — đứng trước mọi event khác trong batch", () => {
    const batch = [
      { kind: "heartbeat", ledger: 5 },
      { kind: "transaction.settled", ledger: 3 },
      { kind: "recovery.vetoed", ledger: 9 },
      { kind: "inheritance_claimed", ledger: 1 },
    ];
    const ordered = orderByPriority(batch);
    expect(ordered[0]?.kind).toBe("recovery.vetoed");
  });

  it("cùng priority giữ thứ tự ledger tăng dần", () => {
    const batch = [
      { kind: "heartbeat", ledger: 9 },
      { kind: "heartbeat", ledger: 2 },
    ];
    expect(orderByPriority(batch).map((e) => e.ledger)).toEqual([2, 9]);
  });

  it("event lạ: known=false, không notify, KHÔNG vứt", () => {
    const route = routeEvent("weird_topic");
    expect(route.known).toBe(false);
    expect(route.notifyTemplate).toBeNull();
  });

  it("event cần người biết ngay có template notify", () => {
    expect(routeEvent("recovery.vetoed").notifyTemplate).toBe("recovery.vetoed");
    expect(routeEvent("inheritance_opened").notifyTemplate).toBe("inheritance.opened");
    expect(routeEvent("approval.requested").notifyTemplate).toBe("approval.requested");
  });
});
