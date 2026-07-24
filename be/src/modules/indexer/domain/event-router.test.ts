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

  it("topic registry on-chain (PHA 5.2): cancel = veto priority 0, đứng đầu batch", () => {
    const ordered = orderByPriority([
      { kind: "initiate", ledger: 1 },
      { kind: "cancel", ledger: 9 },
      { kind: "approve", ledger: 2 },
    ]);
    expect(ordered[0]?.kind).toBe("cancel");
    expect(routeEvent("cancel").notifyTemplate).toBe("recovery.vetoed");
  });

  it("topic registry: ví match theo topics[1], có template cho chuỗi recovery", () => {
    for (const kind of [
      "register",
      "g_add",
      "g_remove",
      "initiate",
      "approve",
      "cancel",
      "finalize",
    ]) {
      expect(routeEvent(kind).walletFromTopic).toBe(true);
      expect(routeEvent(kind).known).toBe(true);
    }
    expect(routeEvent("initiate").notifyTemplate).toBe("recovery.initiated");
    expect(routeEvent("approve").notifyTemplate).toBe("recovery.approved");
    expect(routeEvent("finalize").notifyTemplate).toBe("recovery.finalized");
    // Event pipeline/không-registry KHÔNG match theo topic.
    expect(routeEvent("recovery.vetoed").walletFromTopic).toBeUndefined();
  });
});
