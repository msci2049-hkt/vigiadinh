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
  /** Địa chỉ đã từng gửi thành công (mirror từ lịch sử settled). Từ v3 đây CHỈ
   * là dữ kiện cho cảnh báo mềm — KHÔNG còn là giấy thông hành qua `per_tx`. */
  knownRecipients: readonly string[];
  /** Địa chỉ on-chain của guardian ĐANG hiệu lực (status != removed). Tách khỏi
   * `knownRecipients` ở lô 2026-07-30: hai thứ này có chi phí giả mạo lệch nhau
   * 8 bậc độ lớn (chữ ký on-chain thu hồi được ↔ 1 stroop vĩnh viễn) nên KHÔNG
   * được dùng chung một cửa miễn trừ. v1/v2 không đọc field này. */
  guardianAddresses: readonly string[];
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

/** v2 (lô policy 2026-07-29, C1-C4) — `unknown_recipient` KHÔNG còn tự nó bắt
 * duyệt: gửi lần đầu cho bất kỳ ai cũng phải chờ người thân là chặn dùng hằng
 * ngày. Ngữ nghĩa chốt theo bảng test §4/§6 của lô:
 * - per_tx CHỈ áp cho ĐỊA CHỈ LẠ (chống chuyển khoản lớn cho kẻ lừa đảo);
 *   người quen (đã gửi settled / guardian của ví — caller nạp vào
 *   knownRecipients) gửi lớn đi thẳng ("gửi 5000 XLM cho guardian → đi thẳng").
 * - daily (rolling 24h) áp cho TẤT CẢ — trần tổng dòng tiền rời ví, và trần
 *   cứng cuối cùng vẫn là policy on-chain rule 0.
 * - Địa chỉ lạ dưới ngưỡng → allow, reasons chở `unknown_recipient` để UI hiện
 *   cảnh báo mềm "bạn chưa từng gửi cho địa chỉ này" — không chặn (C5). */
const evaluateV2: PolicyFn = (ctx) => {
  if (ctx.recipient !== null && ctx.blacklist.includes(ctx.recipient)) {
    return { decision: "require_guardian", reasons: ["blacklisted_recipient"] };
  }
  if (ctx.amount === null || ctx.recipient === null) {
    return { decision: "require_guardian", reasons: ["non_payment_review"] };
  }
  const known = ctx.knownRecipients.includes(ctx.recipient);
  const gating: PolicyReasonCode[] = [];
  if (!known && ctx.perTxLimit !== null && ctx.amount > ctx.perTxLimit) {
    gating.push("over_tx_limit");
  }
  if (ctx.dailyLimit !== null && ctx.dailySpent + ctx.amount > ctx.dailyLimit) {
    gating.push("over_daily_limit");
  }
  if (gating.length > 0) {
    return { decision: "require_guardian", reasons: gating };
  }
  if (ctx.nightWatchDelay) {
    return { decision: "delay", reasons: ["risk_delay"] };
  }
  return {
    decision: "allow",
    reasons: [known ? "known_recipient_under_limit" : "unknown_recipient"],
  };
};

/** v3 (lô vá cửa hậu 2026-07-30) — ĐÓNG lỗ "gửi 1 lần = miễn `per_tx` vĩnh viễn".
 *
 * v2 viết `if (!known && … amount > perTxLimit)`, trong đó `known` là hợp của
 * HAI tập rất khác nhau. Hậu quả đã khai thác được trên ví thật: gửi 100 XLM cho
 * địa chỉ lạ (dưới ngưỡng, đi thẳng) → địa chỉ đó settled → 52 giây sau gửi 600
 * XLM cho CHÍNH nó (3× `per_tx` 200) vẫn đi thẳng, không ai duyệt. Ngưỡng
 * `per_tx` trở thành vô nghĩa với bất kỳ ai chịu bỏ một giao dịch mồi.
 *
 * v3 chỉ đổi ĐÚNG MỘT Ô của bảng quyết định:
 * - `per_tx` áp cho MỌI địa chỉ. Miễn trừ DUY NHẤT là guardian đang hiệu lực —
 *   họ đã ký cam kết on-chain kiểm chứng được, và gỡ guardian là mất miễn trừ
 *   ngay (`guardianAddresses` lọc `status != 'removed'`).
 * - "Địa chỉ đã từng gửi" tụt xuống đúng vai trò của nó: dữ kiện cho CẢNH BÁO
 *   MỀM ở màn xác nhận, không phải cổng chính sách.
 * - `daily` giữ nguyên: áp cho TẤT CẢ, kể cả guardian — không nới.
 * - Sổ đen / phi-thanh-toán / night-watch giữ nguyên v2.
 *
 * Đánh đổi đã được chủ ví chấp nhận: gửi định kỳ vượt `per_tx` phải duyệt mỗi
 * lần. Lối ra đúng là NÂNG `per_tx` (nâng phải chờ 24h — kẻ chiếm ví không dùng
 * được), không phải nới lại cổng này. */
const evaluateV3: PolicyFn = (ctx) => {
  if (ctx.recipient !== null && ctx.blacklist.includes(ctx.recipient)) {
    return { decision: "require_guardian", reasons: ["blacklisted_recipient"] };
  }
  if (ctx.amount === null || ctx.recipient === null) {
    return { decision: "require_guardian", reasons: ["non_payment_review"] };
  }
  const isGuardian = ctx.guardianAddresses.includes(ctx.recipient);
  // `familiar` CHỈ quyết định câu chữ cảnh báo mềm, KHÔNG quyết định cổng nào.
  const familiar = isGuardian || ctx.knownRecipients.includes(ctx.recipient);
  const gating: PolicyReasonCode[] = [];
  if (!isGuardian && ctx.perTxLimit !== null && ctx.amount > ctx.perTxLimit) {
    gating.push("over_tx_limit");
  }
  if (ctx.dailyLimit !== null && ctx.dailySpent + ctx.amount > ctx.dailyLimit) {
    gating.push("over_daily_limit");
  }
  if (gating.length > 0) {
    return { decision: "require_guardian", reasons: gating };
  }
  if (ctx.nightWatchDelay) {
    return { decision: "delay", reasons: ["risk_delay"] };
  }
  return {
    decision: "allow",
    reasons: [familiar ? "known_recipient_under_limit" : "unknown_recipient"],
  };
};

/** Registry — THÊM version mới vào đây, KHÔNG sửa version cũ (bất biến versioning). */
const POLICY_ENGINES: Record<number, PolicyFn> = {
  1: evaluateV1,
  2: evaluateV2,
  3: evaluateV3,
};

export const CURRENT_POLICY_VERSION = 3;

export function evaluatePolicy(
  ctx: PolicyContext,
  version: number = CURRENT_POLICY_VERSION,
): PolicyResult {
  const engine = POLICY_ENGINES[version];
  if (!engine) throw new Error(`POLICY_VERSION_UNKNOWN:${version}`);
  return { ...engine(ctx), policyVersion: version };
}
