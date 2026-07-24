// Test PHỦ MỌI CẶP CẤM (P2, cổng nghiệm thu skill pipeline #1): duyệt toàn bộ
// không gian (state × actor × action) — cái nào ngoài bảng phải trả null; cộng
// các bất biến nghiệp vụ gọi tên trực tiếp để regression đọc được ngay.
import { describe, expect, it } from "bun:test";
import { INTENT_STATES, type IntentState } from "@/shared-contract/intent";
import {
  assertTransition,
  INTENT_ACTIONS,
  INTENT_ACTORS,
  INTENT_TRANSITIONS,
  nextState,
  TERMINAL_STATES,
} from "./state-machine";

describe("intent state machine", () => {
  it("bảng không có dòng trùng (from, actor, action)", () => {
    const keys = INTENT_TRANSITIONS.map(([f, a, act]) => `${f}|${a}|${act}`);
    expect(new Set(keys).size).toBe(INTENT_TRANSITIONS.length);
  });

  it("mọi tổ hợp NGOÀI bảng trả null — đếm đúng số đường hợp lệ", () => {
    let allowed = 0;
    for (const state of INTENT_STATES) {
      for (const actor of INTENT_ACTORS) {
        for (const action of INTENT_ACTIONS) {
          const to = nextState(state, actor, action);
          if (to !== null) {
            allowed++;
            expect(INTENT_STATES).toContain(to);
          }
        }
      }
    }
    expect(allowed).toBe(INTENT_TRANSITIONS.length);
  });

  it("terminal states không có đường ra", () => {
    for (const state of TERMINAL_STATES) {
      const outgoing = INTENT_TRANSITIONS.filter(([from]) => from === state);
      expect(outgoing).toHaveLength(0);
    }
  });

  it("mọi state của shared contract xuất hiện trong bảng (không state mồ côi)", () => {
    const seen = new Set<IntentState>();
    for (const [from, , , to] of INTENT_TRANSITIONS) {
      seen.add(from);
      seen.add(to);
    }
    for (const state of INTENT_STATES) {
      expect(seen.has(state), `state mồ côi: ${state}`).toBe(true);
    }
  });

  it("AI bị nhốt ở draft: chỉ request_clarify (draft→draft), không gì khác", () => {
    const aiRows = INTENT_TRANSITIONS.filter(([, actor]) => actor === "ai");
    expect(aiRows).toEqual([["draft", "ai", "request_clarify", "draft"]]);
  });

  it("guardian không ký, không submit, không cancel hộ", () => {
    for (const state of INTENT_STATES) {
      expect(nextState(state, "guardian", "sign")).toBeNull();
      expect(nextState(state, "guardian", "submit")).toBeNull();
      expect(nextState(state, "guardian", "cancel")).toBeNull();
    }
  });

  it("owner không tự approve; system không cancel (risk chỉ trì hoãn)", () => {
    for (const state of INTENT_STATES) {
      expect(nextState(state, "owner", "guardian_approve")).toBeNull();
      expect(nextState(state, "system", "cancel")).toBeNull();
    }
  });

  it("sau APPROVED không có đường thẳng tới submitting — bắt buộc re-evaluate (P3)", () => {
    expect(nextState("approved", "owner", "sign")).toBeNull();
    expect(nextState("approved", "system", "submit_ok")).toBeNull();
    expect(nextState("approved", "system", "reevaluate_allow")).toBe("awaiting_signature");
    expect(nextState("approved", "system", "reevaluate_require_guardian")).toBe(
      "awaiting_guardian",
    );
  });

  it("không cancel được khi đang submitting (tiền có thể đã đi)", () => {
    expect(nextState("submitting", "owner", "cancel")).toBeNull();
  });

  it("challenge hết hạn quay về review, không chết hẳn (A4)", () => {
    expect(nextState("awaiting_signature", "system", "challenge_expire")).toBe("review");
  });

  it("assertTransition ném INVALID_TRANSITION có ngữ cảnh cho đường cấm", () => {
    expect(() => assertTransition("settled", "owner", "cancel")).toThrow(
      "INVALID_TRANSITION:settled:owner:cancel",
    );
    expect(assertTransition("draft", "owner", "submit")).toBe("validating");
  });
});
