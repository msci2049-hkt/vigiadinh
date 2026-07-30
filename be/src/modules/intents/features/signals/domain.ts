// View TÍN HIỆU RỦI RO của một lệnh chuyển (lô R2) — THUẦN, khoá key-list như
// pendingApprovalView: về mặt kiểu không có chỗ cho số dư / lịch sử / challenge
// lọt ra. Đây là LỚP 2 (quyết định deterministic) nói bằng số — LỚP 3 (LLM) chỉ
// được ĐỌC object này để diễn đạt, không bao giờ được sửa nó.
//
// policyOutcome ĐỌC từ policy_decision đã ghi trên intent (kết quả evaluateV3
// lúc confirm) — KHÔNG đánh giá lại ở đây: đánh giá lại bằng version mới nhất
// là đúng cái lỗi "re-eval chưa ghim version" đã ghi nợ.
export type IntentSignals = {
  /** Stroops, chuỗi — bigint qua JSON an toàn. */
  amount: string;
  /** Đủ 56 ký tự — guardian phải đối chiếu được, không rút gọn. */
  recipient: string;
  /** Gấp mấy lần mức thường ngày 30 ngày. null khi ví chưa đủ 3 lệnh settled —
   * ví mới không có "mức thường ngày", không bịa tỉ lệ từ 1 giao dịch. */
  ratioToAvg: number | null;
  /** Số lần đã gửi THÀNH CÔNG tới địa chỉ này. 0 = lần đầu (LẠ). */
  recipientSettledCount: number;
  txCountLastHour: number;
  /** Tổng stroops 1 giờ qua (mọi lệnh trừ cancelled), chuỗi. */
  totalLastHour: string;
  policyOutcome: "direct" | "awaiting_guardian";
  requiresGuardian: boolean;
};

/** Ngưỡng tối thiểu để "mức thường ngày" có nghĩa. */
export const BASELINE_MIN_SAMPLES = 3;

export function intentSignalsView(input: {
  amount: bigint;
  recipient: string;
  policyDecision: string | null;
  velocity: { txCount: number; total: bigint };
  recipientSettledCount: number;
  baseline: { avgAmount: string | null; n: number };
}): IntentSignals {
  const requiresGuardian = input.policyDecision === "require_guardian";
  return {
    amount: input.amount.toString(),
    recipient: input.recipient,
    ratioToAvg: ratioToAverage(input.amount, input.baseline),
    recipientSettledCount: input.recipientSettledCount,
    txCountLastHour: input.velocity.txCount,
    totalLastHour: input.velocity.total.toString(),
    policyOutcome: requiresGuardian ? "awaiting_guardian" : "direct",
    requiresGuardian,
  };
}

/** Tỉ lệ so mức thường, làm tròn 1 chữ số lẻ. Number đủ chính xác ở đây: sai số
 * double chỉ chạm tới khi amount vượt 2^53 stroops (~900 tỉ XLM, hơn tổng cung). */
function ratioToAverage(
  amount: bigint,
  baseline: { avgAmount: string | null; n: number },
): number | null {
  if (baseline.n < BASELINE_MIN_SAMPLES || baseline.avgAmount === null) return null;
  const avg = Number(baseline.avgAmount);
  if (!Number.isFinite(avg) || avg <= 0) return null;
  return Math.round((Number(amount) / avg) * 10) / 10;
}
