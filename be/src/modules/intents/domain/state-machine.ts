// State machine TransactionIntent (PHA 3.2, P2 skill vi-backend-pipeline §1):
// bảng (state, actor, action) → state' TƯỜNG MINH — mọi chuyển ngoài bảng là 409
// INVALID_TRANSITION + audit (route lo). Enum state = shared/intent.ts (AUTO-SYNC
// src/shared-contract/intent.ts) — file này CHỈ thêm actor/action/bảng, không
// định nghĩa lại state.
//
// Bất biến nghiệp vụ mã hoá thẳng vào bảng:
// - AI chỉ được `create_draft` (tạo ROW, không phải transition) + `request_clarify`
//   (draft → draft). AI KHÔNG submit, KHÔNG confirm, KHÔNG đi xa hơn draft.
// - Guardian chỉ approve/reject khi AWAITING_GUARDIAN. Không ký, không cancel hộ.
// - Sau APPROVED bắt buộc qua re-evaluate của system (P3) — không có đường
//   approved → submitting thẳng.
// - Terminal (settled/rejected/expired/cancelled) KHÔNG có dòng nào đi ra;
//   submit_failed retry được (owner, sau khi system query tx hash).
// - Risk/policy chỉ delay hoặc đòi guardian — KHÔNG có action nào của system
//   cancel intent (luật security "risk không bao giờ tự cancel").
import type { IntentState } from "@/shared-contract/intent";

export const INTENT_ACTORS = ["owner", "guardian", "system", "ai"] as const;
export type IntentActor = (typeof INTENT_ACTORS)[number];

export const INTENT_ACTIONS = [
  "request_clarify", // ai: hỏi lại cho rõ — intent đứng yên ở draft
  "submit", // owner: gửi draft vào pipeline
  "cancel", // owner: huỷ khi tiền CHƯA đi (trước submitting)
  "validate_pass",
  "validate_fail",
  "confirm", // owner: xác nhận màn review
  "policy_allow",
  "policy_require_guardian",
  "policy_delay", // đứng yên ở policy_gate — re-run sau (risk chỉ trì hoãn)
  "guardian_approve",
  "guardian_reject",
  "reevaluate_allow", // system: P3 — re-run policy sau approval
  "reevaluate_require_guardian", // policy đổi/số dư đổi → cần duyệt lại
  "sign", // owner: biometric + ký
  "challenge_expire", // TTL challenge 2-5' → quay lại review (A4)
  "expire", // sweeper TTL draft/approval
  "submit_ok",
  "submit_fail",
  "retry_submit", // owner: SAU khi system query tx hash xác nhận chưa lên mạng
] as const;
export type IntentAction = (typeof INTENT_ACTIONS)[number];

type TransitionRow = readonly [IntentState, IntentActor, IntentAction, IntentState];

/** Bảng chuyển trạng thái — NGUỒN SỰ THẬT duy nhất. Đọc: (from, actor, action) → to. */
export const INTENT_TRANSITIONS: readonly TransitionRow[] = [
  ["draft", "ai", "request_clarify", "draft"],
  ["draft", "owner", "submit", "validating"],
  ["draft", "owner", "cancel", "cancelled"],
  ["draft", "system", "expire", "expired"],

  ["validating", "system", "validate_pass", "review"],
  ["validating", "system", "validate_fail", "rejected"],

  ["review", "owner", "confirm", "policy_gate"],
  ["review", "owner", "cancel", "cancelled"],
  ["review", "system", "expire", "expired"],

  ["policy_gate", "system", "policy_allow", "awaiting_signature"],
  ["policy_gate", "system", "policy_require_guardian", "awaiting_guardian"],
  ["policy_gate", "system", "policy_delay", "policy_gate"],
  ["policy_gate", "owner", "cancel", "cancelled"],

  ["awaiting_guardian", "guardian", "guardian_approve", "approved"],
  ["awaiting_guardian", "guardian", "guardian_reject", "rejected"],
  ["awaiting_guardian", "owner", "cancel", "cancelled"],
  ["awaiting_guardian", "system", "expire", "expired"],

  ["approved", "system", "reevaluate_allow", "awaiting_signature"],
  ["approved", "system", "reevaluate_require_guardian", "awaiting_guardian"],
  ["approved", "system", "expire", "expired"],

  ["awaiting_signature", "owner", "sign", "submitting"],
  ["awaiting_signature", "owner", "cancel", "cancelled"],
  ["awaiting_signature", "system", "challenge_expire", "review"],
  ["awaiting_signature", "system", "expire", "expired"],

  ["submitting", "system", "submit_ok", "settled"],
  ["submitting", "system", "submit_fail", "submit_failed"],

  ["submit_failed", "owner", "retry_submit", "submitting"],
] as const;

/** Trạng thái kết thúc — không dòng nào trong bảng đi ra từ đây (có test khoá). */
export const TERMINAL_STATES: readonly IntentState[] = [
  "settled",
  "rejected",
  "expired",
  "cancelled",
];

/** Tra bảng — null nếu chuyển KHÔNG hợp lệ (caller quyết 409 + audit). */
export function nextState(
  from: IntentState,
  actor: IntentActor,
  action: IntentAction,
): IntentState | null {
  for (const [f, a, act, to] of INTENT_TRANSITIONS) {
    if (f === from && a === actor && act === action) return to;
  }
  return null;
}

/** Route/service dùng bản throw — error.ts map INVALID_TRANSITION → 409. */
export function assertTransition(
  from: IntentState,
  actor: IntentActor,
  action: IntentAction,
): IntentState {
  const to = nextState(from, actor, action);
  if (to === null) {
    throw new Error(`INVALID_TRANSITION:${from}:${actor}:${action}`);
  }
  return to;
}
