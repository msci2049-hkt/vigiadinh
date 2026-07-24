// Cảnh báo THEO QUY TẮC cho người bảo hộ trước khi duyệt khôi phục (PHA 2.4).
// THUẦN + TESTABLE — KHÔNG phải AI, KHÔNG gọi mạng, KHÔNG model. Chỉ soi các
// trường sẵn có của yêu cầu để nhắc người bảo hộ CẨN TRỌNG. Luật 6: cảnh báo
// CHỈ nhắc/trì hoãn, KHÔNG BAO GIỜ tự chặn duyệt — người bảo hộ vẫn tự quyết.
import type { RecoveryRequest } from "../api/recovery";

export type WarningKey =
  | "guardian.approveWarning.rules.newKey"
  | "guardian.approveWarning.rules.unusualHour"
  | "guardian.approveWarning.rules.veryRecent"
  | "guardian.approveWarning.rules.flagged";

const UNUSUAL_HOUR_START = 0; // 00:00
const UNUSUAL_HOUR_END = 6; // trước 06:00 local = giờ bất thường
const VERY_RECENT_MS = 30 * 60_000; // mở trong 30' + ít phiếu = mới tinh
const FLAGGED_SCORE = 60; // ngưỡng riskScore server đánh dấu (nếu có)

/**
 * Đánh giá yêu cầu khôi phục bằng QUY TẮC THUẦN. Trả danh sách cảnh báo đã kích
 * (thứ tự ưu tiên hiển thị). `newKey` LUÔN có: khôi phục luôn cài khoá MỚI toanh
 * → nhắc người bảo hộ đối chiếu vân tay khoá qua kênh ngoài (chống ký mù/social
 * engineering — cùng lớp K2). Các quy tắc khác chỉ kích khi dữ liệu thoả.
 */
export function evaluateRecoveryWarnings(
  request: Pick<RecoveryRequest, "startedAt" | "approvals" | "riskScore">,
  opts: { now?: Date } = {},
): WarningKey[] {
  const now = opts.now ?? new Date();
  const started = new Date(request.startedAt);
  const out: WarningKey[] = ["guardian.approveWarning.rules.newKey"];

  const hour = started.getHours();
  if (hour >= UNUSUAL_HOUR_START && hour < UNUSUAL_HOUR_END) {
    out.push("guardian.approveWarning.rules.unusualHour");
  }

  const ageMs = now.getTime() - started.getTime();
  if (ageMs >= 0 && ageMs <= VERY_RECENT_MS && request.approvals <= 1) {
    out.push("guardian.approveWarning.rules.veryRecent");
  }

  if (request.riskScore !== null && request.riskScore >= FLAGGED_SCORE) {
    out.push("guardian.approveWarning.rules.flagged");
  }

  return out;
}
