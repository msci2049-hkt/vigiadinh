// Policy engine (PHA 3.4, A5/P5) — THUẦN function, VERSION HOÁ, trả reason codes.
// - Thuần: không env/DB/IO — context caller nạp sẵn; test hermetic 100%.
// - Version hoá: registry {version → engine}. Intent cũ đánh giá lại bằng ĐÚNG
//   version đã ghi trên nó (đổi policy không ảnh hưởng intent cũ — có test khoá).
// - P5: không boolean trần — mọi quyết định kèm reason codes từ shared contract.
// - Luật security: engine KHÔNG có quyết định "cancel" — chỉ allow / đòi guardian
//   / delay (night-watch chỉ trì hoãn).
import type { PolicyDecision, PolicyReasonCode } from "@/shared-contract/intent";

export type PolicyContext = {
  amount: bigint | null;
  recipient: string | null;
  /** Địa chỉ đã từng gửi thành công (mirror từ lịch sử settled). */
  knownRecipients: readonly string[];
  /** Sổ đen gia đình. */
  blacklist: readonly string[];
  /** Hạn mức một giao dịch / ngày (stroops); null = không đặt. */
  perTxLimit: bigint | null;
  dailyLimit: bigint | null;
  /** Đã chi trong ngày (stroops, settled). */
  dailySpent: bigint;
  /** Cờ night-watch (risk engine) — CHỈ trì hoãn, không bao giờ cancel. */
  nightWatchDelay: boolean;
};

export type PolicyResult = {
  decision: PolicyDecision;
  policyVersion: number;
  reasons: PolicyReasonCode[];
};

type PolicyFn = (ctx: PolicyContext) => Omit<PolicyResult, "policyVersion">;

/** v1 — thứ tự ưu tiên: sổ đen > phi-thanh-toán > hạn mức/người lạ > delay > allow. */
const evaluateV1: PolicyFn = (ctx) => {
  const reasons: PolicyReasonCode[] = [];

  if (ctx.recipient !== null && ctx.blacklist.includes(ctx.recipient)) {
    return { decision: "require_guardian", reasons: ["blacklisted_recipient"] };
  }
  // Intent không phải thanh toán (đổi guardian/policy/cấu hình) — luôn người thật duyệt.
  if (ctx.amount === null || ctx.recipient === null) {
    return { decision: "require_guardian", reasons: ["non_payment_review"] };
  }
  if (!ctx.knownRecipients.includes(ctx.recipient)) {
    reasons.push("unknown_recipient");
  }
  if (ctx.perTxLimit !== null && ctx.amount > ctx.perTxLimit) {
    reasons.push("over_tx_limit");
  }
  if (ctx.dailyLimit !== null && ctx.dailySpent + ctx.amount > ctx.dailyLimit) {
    reasons.push("over_daily_limit");
  }
  if (reasons.length > 0) {
    return { decision: "require_guardian", reasons };
  }
  if (ctx.nightWatchDelay) {
    return { decision: "delay", reasons: ["risk_delay"] };
  }
  return { decision: "allow", reasons: ["known_recipient_under_limit"] };
};

/** Registry — THÊM version mới vào đây, KHÔNG sửa version cũ (bất biến versioning). */
const POLICY_ENGINES: Record<number, PolicyFn> = {
  1: evaluateV1,
};

export const CURRENT_POLICY_VERSION = 1;

export function evaluatePolicy(
  ctx: PolicyContext,
  version: number = CURRENT_POLICY_VERSION,
): PolicyResult {
  const engine = POLICY_ENGINES[version];
  if (!engine) throw new Error(`POLICY_VERSION_UNKNOWN:${version}`);
  return { ...engine(ctx), policyVersion: version };
}
