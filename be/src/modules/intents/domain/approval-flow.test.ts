// Test P3 (re-evaluate sau approval) hermetic — policy tiêm fake qua port.
import { describe, expect, it } from "bun:test";
import { acceptGuardianApproval, type PolicyPort } from "./approval-flow";
import { type ChallengeBindingInput, computeChallengeHash } from "./hashing";

const binding: ChallengeBindingInput = {
  intentHash: "b".repeat(64),
  amount: 5_000_000n,
  recipient: "GABC",
  policyVersion: 1,
  expiresAtEpoch: 1_800_000_000,
};
const boundHash = computeChallengeHash(binding);
const wallet = { walletId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", amount: 5_000_000n, recipient: "GABC" };

const allowPolicy: PolicyPort = {
  evaluate: () => ({
    decision: "allow",
    policyVersion: 2,
    reasons: ["known_recipient_under_limit"],
  }),
};

describe("guardian approval + re-evaluate (P3)", () => {
  it("policy allow sau re-eval → awaiting_signature", () => {
    const out = acceptGuardianApproval({
      intentStatus: "awaiting_guardian",
      approvalChallengeHash: boundHash,
      currentBinding: binding,
      policy: allowPolicy,
      wallet,
    });
    expect(out.nextStatus).toBe("awaiting_signature");
    expect(out.policyVersion).toBe(2);
  });

  it("policy đổi ý (require_guardian) → quay lại awaiting_guardian + reevaluation_required", () => {
    const strict: PolicyPort = {
      evaluate: () => ({
        decision: "require_guardian",
        policyVersion: 3,
        reasons: ["over_daily_limit"],
      }),
    };
    const out = acceptGuardianApproval({
      intentStatus: "awaiting_guardian",
      approvalChallengeHash: boundHash,
      currentBinding: binding,
      policy: strict,
      wallet,
    });
    expect(out.nextStatus).toBe("awaiting_guardian");
    expect(out.reasons).toContain("reevaluation_required");
  });

  it("delay khi re-eval xử như require_guardian (an toàn hơn, không mở ký)", () => {
    const delayed: PolicyPort = {
      evaluate: () => ({ decision: "delay", policyVersion: 2, reasons: ["risk_delay"] }),
    };
    const out = acceptGuardianApproval({
      intentStatus: "awaiting_guardian",
      approvalChallengeHash: boundHash,
      currentBinding: binding,
      policy: delayed,
      wallet,
    });
    expect(out.nextStatus).toBe("awaiting_guardian");
  });

  it("K5: binding lệch (intent đã sửa) → APPROVAL_BINDING_MISMATCH, policy KHÔNG được gọi", () => {
    let policyCalled = false;
    const spy: PolicyPort = {
      evaluate: () => {
        policyCalled = true;
        return { decision: "allow", policyVersion: 2, reasons: [] };
      },
    };
    expect(() =>
      acceptGuardianApproval({
        intentStatus: "awaiting_guardian",
        approvalChallengeHash: boundHash,
        currentBinding: { ...binding, amount: 999n },
        policy: spy,
        wallet,
      }),
    ).toThrow("APPROVAL_BINDING_MISMATCH");
    expect(policyCalled).toBe(false);
  });

  it("intent không ở awaiting_guardian → INVALID_TRANSITION (409)", () => {
    expect(() =>
      acceptGuardianApproval({
        intentStatus: "draft",
        approvalChallengeHash: boundHash,
        currentBinding: binding,
        policy: allowPolicy,
        wallet,
      }),
    ).toThrow("INVALID_TRANSITION:draft:guardian:guardian_approve");
  });
});
