// Thang heartbeat thừa kế (PHA 4.3, pipeline §6) — THUẦN. Chu kỳ mặc định 30
// ngày (inheritance_plans.inactivity_period_secs). Thang leo theo SỐ KỲ im lặng:
//   tier 0 — khoẻ (im lặng < 1 kỳ)
//   tier 1 — 1 kỳ: nhắc CHỦ VÍ dày hơn ("bạn vẫn ổn chứ?")
//   tier 2 — 2 kỳ: hỏi qua NGƯỜI THÂN ("nhờ bạn hỏi thăm")
//   tier 3 — 3 kỳ: server GỢI Ý người thân mở claim — mở claim là hành động
//            ON-CHAIN CỦA GUARDIAN, server không có quyền và không bao giờ tự làm.
// Owner phản hồi bất kỳ lúc nào trước execute → reset tier 0 + hủy pending.

export const SUGGEST_CLAIM_TIER = 3;

export function heartbeatTier(
  lastBeatAt: Date | null,
  inactivityPeriodSecs: number,
  now: Date,
): number {
  if (!lastBeatAt) return 0; // chưa từng beat = plan mới kích hoạt — kỳ đầu tính từ activate
  const silenceSecs = (now.getTime() - lastBeatAt.getTime()) / 1000;
  const periods = Math.floor(silenceSecs / inactivityPeriodSecs);
  return Math.min(periods, SUGGEST_CLAIM_TIER);
}

/** Template notify cho từng tier — tier 0 không gửi gì. */
export function tierTemplate(
  tier: number,
): { template: string; audience: "owner" | "guardians" } | null {
  switch (tier) {
    case 1:
      return { template: "heartbeat.reminder", audience: "owner" };
    case 2:
      return { template: "heartbeat.guardian_check", audience: "guardians" };
    case 3:
      return { template: "inheritance.suggest_claim", audience: "guardians" };
    default:
      return null;
  }
}
