// Ngữ nghĩa NGƯỠNG MỀM chi tiêu (lô policy 2026-07-29) — THUẦN function, không
// env/DB/IO, test hermetic. Hai bất biến an ninh:
// 1. "Nâng" = NỚI LỎNG: chỉ cần MỘT trong hai ngưỡng tăng là nâng — giảm cái
//    này tăng cái kia vẫn phải chờ 24h (kẻ chiếm tài khoản không đổi chác được).
// 2. Ngưỡng mềm không bao giờ vượt TRẦN CỨNG on-chain — vượt là chối từ input.
export const DEFAULT_PER_TX_STROOPS = 10_000_000_000n; // 1.000 XLM
export const DEFAULT_DAILY_STROOPS = 100_000_000_000n; // 10.000 XLM

/** Trần cứng on-chain gắn vào rule 0 lúc tạo ví (D2): 20.000 XLM — gấp đôi
 * daily mặc định, để ngưỡng mềm luôn có chỗ nới mà không đụng trần. */
export const ONCHAIN_CAP_STROOPS = 200_000_000_000n; // 20.000 XLM
/** Cửa sổ đo của policy on-chain: ~1 ngày ledger (ledger ≈ 5s → 17280/ngày). */
export const ONCHAIN_PERIOD_LEDGERS = 17_280;

/** Nâng ngưỡng chờ bao lâu mới hiệu lực (B2). */
export const RAISE_DELAY_SECONDS = 86_400;

export type PolicyLimits = { perTxLimit: bigint; dailyLimit: bigint };

export class PolicyValidationError extends Error {
  constructor(code: "BAD_LIMITS" | "DAILY_BELOW_PER_TX" | "ABOVE_ONCHAIN_CAP") {
    super(code);
    this.name = "PolicyValidationError";
  }
}

/** Validate input người dùng (E2): >0 · daily ≥ per_tx · cả hai ≤ trần on-chain. */
export function assertValidLimits(next: PolicyLimits): void {
  if (next.perTxLimit <= 0n || next.dailyLimit <= 0n) {
    throw new PolicyValidationError("BAD_LIMITS");
  }
  if (next.dailyLimit < next.perTxLimit) {
    throw new PolicyValidationError("DAILY_BELOW_PER_TX");
  }
  if (next.perTxLimit > ONCHAIN_CAP_STROOPS || next.dailyLimit > ONCHAIN_CAP_STROOPS) {
    throw new PolicyValidationError("ABOVE_ONCHAIN_CAP");
  }
}

/**
 * Phân loại đổi ngưỡng (B1/B2): BẤT KỲ chiều nào tăng → "raise" (chờ 24h).
 * Không chiều nào tăng (bằng hoặc giảm) → "lower" (áp ngay — an toàn hơn thì
 * không cần chờ).
 */
export function classifyChange(current: PolicyLimits, next: PolicyLimits): "raise" | "lower" {
  const raises = next.perTxLimit > current.perTxLimit || next.dailyLimit > current.dailyLimit;
  return raises ? "raise" : "lower";
}
