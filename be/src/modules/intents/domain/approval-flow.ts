// Luồng nhận phiếu guardian + RE-EVALUATE bắt buộc (P3, PHA 3.3). Thuần domain —
// policy tiêm qua port (engine thật đến ở PHA 3.4), DB không đụng ở đây: caller
// (feature handler) load/persist. Nhờ vậy toàn bộ nhánh test hermetic được.
import type { PolicyDecision, PolicyReasonCode } from "@/shared-contract/intent";
import { type ChallengeBindingInput, isApprovalBound } from "./hashing";
import { assertTransition } from "./state-machine";

/** Port policy — 3.4 cắm engine thật (thuần function, version hoá). */
export type PolicyPort = {
  evaluate(input: { walletId: string; amount: bigint | null; recipient: string | null }): {
    decision: PolicyDecision;
    policyVersion: number;
    reasons: PolicyReasonCode[];
  };
};

export type ApprovalOutcome = {
  /** Trạng thái intent sau khi nhận phiếu + re-evaluate. */
  nextStatus: "awaiting_signature" | "awaiting_guardian";
  decision: PolicyDecision;
  policyVersion: number;
  reasons: PolicyReasonCode[];
};

/**
 * Nhận phiếu APPROVE của guardian:
 * 0. NGƯỠNG = MỘT người. Duyệt CHI TIÊU cần đúng một người thân đồng ý; hàm này
 *    KHÔNG đếm phiếu và đó là CHỦ Ý, không phải thiếu sót. Đừng đọc nhầm sang
 *    `wallets.threshold` (mặc định 2) — cột đó thuộc về KHÔI PHỤC VÍ, nơi 2/3
 *    phiếu là bắt buộc vì hậu quả là mất quyền kiểm soát ví vĩnh viễn. Hai
 *    luồng, hai mức rủi ro, hai ngưỡng khác nhau:
 *      - chi tiêu vượt hạn mức → 1 người thân (tiền có trần `daily` chặn phía sau)
 *      - khôi phục ví sang thiết bị mới → 2/3 người thân + timelock
 *    Muốn nâng ngưỡng chi tiêu lên 2 thì phải đếm phiếu Ở ĐÂY và đổi cả
 *    `guardianApproveIntent` (nó update status ngay sau MỘT phiếu).
 * 1. K5 — approval phải còn bind đúng intent HIỆN TẠI (challenge_hash tính lại khớp).
 * 2. State machine: awaiting_guardian → approved (guardian) — ngoài bảng là 409.
 * 3. P3 — re-run policy TRƯỚC khi mở awaiting_signature; policy đòi duyệt lại →
 *    quay về awaiting_guardian kèm reason `reevaluation_required` (approval cũ
 *    chỉ mở khoá một lần, không thay chữ ký chủ ví).
 * Delay khi re-eval KHÔNG có trong bảng từ approved — coi như require_guardian
 * (an toàn hơn: đòi người thật nhìn lại).
 */
export function acceptGuardianApproval(input: {
  intentStatus: string;
  approvalChallengeHash: string;
  currentBinding: ChallengeBindingInput;
  policy: PolicyPort;
  wallet: { walletId: string; amount: bigint | null; recipient: string | null };
}): ApprovalOutcome {
  if (!isApprovalBound(input.approvalChallengeHash, input.currentBinding)) {
    throw new Error("APPROVAL_BINDING_MISMATCH");
  }
  // Ném INVALID_TRANSITION → 409 nếu intent không ở awaiting_guardian.
  assertTransition(
    input.intentStatus as Parameters<typeof assertTransition>[0],
    "guardian",
    "guardian_approve",
  );

  const evaluated = input.policy.evaluate(input.wallet);
  if (evaluated.decision === "allow") {
    assertTransition("approved", "system", "reevaluate_allow");
    return {
      nextStatus: "awaiting_signature",
      decision: evaluated.decision,
      policyVersion: evaluated.policyVersion,
      reasons: evaluated.reasons,
    };
  }
  assertTransition("approved", "system", "reevaluate_require_guardian");
  return {
    nextStatus: "awaiting_guardian",
    decision: evaluated.decision,
    policyVersion: evaluated.policyVersion,
    reasons: [...evaluated.reasons, "reevaluation_required"],
  };
}
