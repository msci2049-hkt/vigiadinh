// Test K5/P4 ở tầng domain: sửa BẤT KỲ trường nào của intent → challenge_hash
// lệch → approval cũ chết (isApprovalBound false).
import { describe, expect, it } from "bun:test";
import {
  type ChallengeBindingInput,
  computeChallengeHash,
  computeIntentHash,
  isApprovalBound,
} from "./hashing";

const baseIntent = {
  walletId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  version: 1,
  operations: [{ type: "payment", asset: "native" }],
  recipient: "GABC",
  amount: 10_000_000n,
};

describe("intent hashing", () => {
  it("intent_hash ổn định — không phụ thuộc thứ tự key trong operations", () => {
    const a = computeIntentHash({
      ...baseIntent,
      operations: [{ type: "payment", asset: "native" }],
    });
    const b = computeIntentHash({
      ...baseIntent,
      operations: [{ asset: "native", type: "payment" }],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("đổi amount / recipient / version → intent_hash đổi", () => {
    const base = computeIntentHash(baseIntent);
    expect(computeIntentHash({ ...baseIntent, amount: 10_000_001n })).not.toBe(base);
    expect(computeIntentHash({ ...baseIntent, recipient: "GXYZ" })).not.toBe(base);
    expect(computeIntentHash({ ...baseIntent, version: 2 })).not.toBe(base);
  });

  it("P4: approval bind hash cũ — sửa amount sau approval → binding chết", () => {
    const binding: ChallengeBindingInput = {
      intentHash: computeIntentHash(baseIntent),
      amount: baseIntent.amount,
      recipient: baseIntent.recipient,
      policyVersion: 3,
      expiresAtEpoch: 1_800_000_000,
    };
    const approvalHash = computeChallengeHash(binding);
    expect(isApprovalBound(approvalHash, binding)).toBe(true);

    // Owner sửa amount → version mới → intent_hash + amount trong binding đổi.
    const revised: ChallengeBindingInput = {
      ...binding,
      intentHash: computeIntentHash({ ...baseIntent, version: 2, amount: 999_000_000n }),
      amount: 999_000_000n,
    };
    expect(isApprovalBound(approvalHash, revised)).toBe(false);
  });

  it("đổi policy_version hoặc expires_at cũng giết binding (không tái dùng qua kỳ policy)", () => {
    const binding: ChallengeBindingInput = {
      intentHash: "a".repeat(64),
      amount: null,
      recipient: null,
      policyVersion: 1,
      expiresAtEpoch: 1_800_000_000,
    };
    const approvalHash = computeChallengeHash(binding);
    expect(isApprovalBound(approvalHash, { ...binding, policyVersion: 2 })).toBe(false);
    expect(isApprovalBound(approvalHash, { ...binding, expiresAtEpoch: 1_800_000_001 })).toBe(
      false,
    );
  });
});
