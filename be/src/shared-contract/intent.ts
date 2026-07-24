// AUTO-SYNC từ shared/intent.ts — ĐỪNG SỬA TAY. Sửa ở shared/ rồi chạy `bun run sync:contract`.
// State machine TransactionIntent — theo handoff §03 "Transaction intent lifecycle".
// Đường thẳng : draft → validating → review → policy_gate → awaiting_signature → submitting → settled
// Đường guardian: policy_gate → awaiting_guardian → approved → awaiting_signature (re-evaluate policy
// sau approval TRƯỚC khi ký — số dư/recipient/policy có thể đã đổi).
// Terminal fail: rejected | expired | cancelled | submit_failed — tiền không rời ví.
// PHA 5 dựng bảng transaction_intents theo enum này (CHECK constraint, không pgEnum).
// Quy trình sửa: như shared/contract.ts (sync:contract + check:contract).

export const INTENT_STATES = [
  "draft",
  "validating",
  "review",
  "policy_gate",
  "awaiting_guardian",
  "approved",
  "awaiting_signature",
  "submitting",
  "settled",
  "rejected",
  "expired",
  "cancelled",
  "submit_failed",
] as const;
export type IntentState = (typeof INTENT_STATES)[number];

// Quyết định policy engine — risk CHỈ trì hoãn hoặc yêu cầu duyệt, KHÔNG BAO GIỜ tự cancel.
export const POLICY_DECISIONS = ["allow", "require_guardian", "delay"] as const;
export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

// Reason codes policy trả về để UI giải thích được (handoff §12: "Policy decision trả về
// reason codes"). Mã tiếng Anh; UI render qua i18n key, KHÔNG hiển thị mã trần cho người dùng.
export const POLICY_REASON_CODES = [
  "known_recipient_under_limit", // allow — người nhận quen + dưới ngưỡng
  "unknown_recipient", // require_guardian — chưa từng gửi cho địa chỉ này
  "over_tx_limit", // require_guardian — vượt hạn mức một giao dịch
  "over_daily_limit", // require_guardian — vượt hạn mức ngày
  "blacklisted_recipient", // require_guardian — nằm trong sổ đen gia đình
  "risk_delay", // delay — night-watch nghi ngờ, chỉ trì hoãn
  "reevaluation_required", // sau guardian approval phải chạy policy lại
  "approval_expired", // TTL guardian approval đã hết
  "challenge_expired", // TTL biometric challenge đã hết
  "non_payment_review", // require_guardian — intent không phải thanh toán (đổi cấu hình) luôn cần người thật duyệt
] as const;
export type PolicyReasonCode = (typeof POLICY_REASON_CODES)[number];
