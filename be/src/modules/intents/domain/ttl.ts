// TTL pipeline (A4, skill vi-backend-pipeline §2): hằng số MỘT chỗ — sweeper +
// feature + test cùng đọc. Đơn vị giây.
export const DRAFT_TTL_SECONDS = 24 * 3600; // draft 24h → EXPIRED
export const APPROVAL_TTL_MIN_SECONDS = 15 * 60; // approval 15' (risk cao)
export const APPROVAL_TTL_MAX_SECONDS = 60 * 60; // approval 60' (risk thấp)
export const CHALLENGE_TTL_SECONDS = 5 * 60; // biometric challenge 2-5' → về REVIEW

/** TTL approval theo risk score 0-100: risk cao → cửa sổ ngắn. */
export function approvalTtlSeconds(riskScore: number | null): number {
  if (riskScore === null) return APPROVAL_TTL_MAX_SECONDS;
  const clamped = Math.min(100, Math.max(0, riskScore));
  const span = APPROVAL_TTL_MAX_SECONDS - APPROVAL_TTL_MIN_SECONDS;
  return Math.round(APPROVAL_TTL_MAX_SECONDS - (span * clamped) / 100);
}

export function expiresAtFrom(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}
