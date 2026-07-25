// Service GỬI TIỀN (PHA 6 SEND) — lái intent qua pipeline PHA 3, KHÔNG gọi thẳng
// SAC từ màn nhập. Custody bất biến: BE build+simulate, FE ký entry ví bằng
// passkey, ví phí ký ENVELOPE. Đường ký = passkey → __check_auth → verifier →
// transfer trong MỘT tx (chuỗi hai-nửa, đóng rủi ro kỹ thuật lớn nhất còn lại).
import type { xdr } from "@stellar/stellar-sdk";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import type { IntentState } from "@/shared-contract/intent";
import { acceptGuardianApproval } from "../../domain/approval-flow";
import { computeChallengeHash } from "../../domain/hashing";
import { CURRENT_POLICY_VERSION, evaluatePolicy } from "../../domain/policy-engine";
import { assertTransition } from "../../domain/state-machine";
import {
  balanceArgs,
  isStellarAddress,
  transferArgs,
  validateSignedTransfer,
} from "../../domain/transfer";
import { expiresAtFrom } from "../../domain/ttl";
import * as repo from "../../infra/intents.repository";

/** Hạn mức MỘT giao dịch (stroops) → vượt là đòi guardian. 20 triệu XLM.
 * Hạn mức per-ví là tính năng sau; hằng số này là chính sách mặc định hiện tại. */
export const SEND_PER_TX_LIMIT_STROOPS = 20_000_000n * 10_000_000n;
/** TTL phiếu duyệt guardian cho một intent (giây) — 48h. */
const APPROVAL_TTL_SECONDS = 48 * 3600;

export class SendServiceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    code: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export type SendGateway = {
  build(input: { contractId: string; method: string; args: xdr.ScVal[] }): Promise<BuiltInvoke>;
  invoke(input: {
    contractId: string;
    method: string;
    args: xdr.ScVal[];
    authEntries: xdr.SorobanAuthorizationEntry[];
  }): Promise<{ hash: string; status: string }>;
  read(input: { contractId: string; method: string; args: xdr.ScVal[] }): Promise<unknown>;
};

async function requireOwnedWallet(walletId: string, userId: string) {
  const wallet = await repo.walletById(walletId);
  if (!wallet) throw new SendServiceError(404, "WALLET_NOT_FOUND");
  if (wallet.userId !== userId) throw new SendServiceError(403, "NOT_OWNER");
  return wallet;
}

/** Đọc số dư ví trên SAC (view) — bigint stroops. */
async function readBalance(
  gateway: SendGateway,
  sacContractId: string,
  address: string,
): Promise<bigint> {
  const raw = await gateway.read({
    contractId: sacContractId,
    method: "balance",
    args: balanceArgs(address),
  });
  // scValToNative của i128 → bigint (số lớn) hoặc number (nhỏ). Chuẩn hoá bigint.
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  if (typeof raw === "string") return BigInt(raw);
  throw new SendServiceError(409, "BALANCE_UNREADABLE");
}

export type ReviewResult = {
  intentId: string;
  status: string;
  from: string;
  recipient: string;
  amount: string;
  balance: string;
};

/**
 * Bước 1 — nhập: tạo draft idempotent → validating → **kiểm số dư TRƯỚC biometric**
 * → review. Số dư thiếu = chặn ở đây, KHÔNG tạo tx ký được (DONE-gate).
 */
export async function prepareSend(
  gateway: SendGateway,
  sacContractId: string,
  input: {
    walletId: string;
    userId: string;
    clientIntentId: string;
    recipient: string;
    amount: bigint;
  },
): Promise<ReviewResult> {
  const wallet = await requireOwnedWallet(input.walletId, input.userId);
  if (!isStellarAddress(input.recipient)) throw new SendServiceError(400, "BAD_RECIPIENT");
  if (input.recipient === wallet.stellarAddress) throw new SendServiceError(400, "SELF_TRANSFER");
  if (input.amount <= 0n) throw new SendServiceError(400, "BAD_AMOUNT");

  const { intent } = await repo.createIdempotent({
    walletId: wallet.id,
    clientIntentId: input.clientIntentId,
    createdBy: "owner",
    operations: [
      {
        type: "sac_transfer",
        sac: sacContractId,
        to: input.recipient,
        amount: input.amount.toString(),
      },
    ],
    recipient: input.recipient,
    amount: input.amount,
  });

  // Resume idempotent: nếu intent đã đi xa hơn draft, trả trạng thái hiện tại
  // (không lái lại — POST lặp cùng client_intent_id là an toàn).
  if (intent.status !== "draft" && intent.status !== "validating") {
    const balance = await readBalance(gateway, sacContractId, wallet.stellarAddress);
    return {
      intentId: intent.id,
      status: intent.status,
      from: wallet.stellarAddress,
      recipient: input.recipient,
      amount: input.amount.toString(),
      balance: balance.toString(),
    };
  }

  assertTransition("draft", "owner", "submit"); // → validating (409 nếu sai)
  await repo.updateIntent(intent.id, { status: "validating" });

  const balance = await readBalance(gateway, sacContractId, wallet.stellarAddress);
  if (balance < input.amount) {
    // Chặn TRƯỚC khi tạo tx ký được — draft đứng ở validating, không sang review.
    throw new SendServiceError(400, "INSUFFICIENT_BALANCE", {
      balance: balance.toString(),
      amount: input.amount.toString(),
      shortfall: (input.amount - balance).toString(),
    });
  }

  assertTransition("validating", "system", "validate_pass"); // → review
  const reviewed = await repo.updateIntent(intent.id, { status: "review" });
  return {
    intentId: reviewed.id,
    status: reviewed.status,
    from: wallet.stellarAddress,
    recipient: input.recipient,
    amount: input.amount.toString(),
    balance: balance.toString(),
  };
}

export type ConfirmResult =
  | ({ intentId: string; status: "awaiting_signature" } & BuiltInvoke)
  | { intentId: string; status: "awaiting_guardian"; reasons: string[] };

/**
 * Bước 2 — xác nhận review: chạy policy. allow → build tx transfer + awaiting_signature.
 * require_guardian → tạo phiếu duyệt (bind challenge_hash K5) + awaiting_guardian.
 * delay → đứng policy_gate (risk chỉ trì hoãn, không cancel).
 */
export async function confirmSend(
  gateway: SendGateway,
  sacContractId: string,
  input: { intentId: string; userId: string },
): Promise<ConfirmResult> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId);
  if (intent.recipient === null || intent.amount === null) {
    throw new SendServiceError(400, "NOT_A_TRANSFER");
  }

  assertTransition(intent.status as IntentState, "owner", "confirm"); // → policy_gate (409 nếu sai state)
  await repo.updateIntent(intent.id, { status: "policy_gate" });

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [known, spent] = await Promise.all([
    repo.knownRecipients(wallet.id),
    repo.dailySpent(wallet.id, since),
  ]);
  const policy = evaluatePolicy({
    amount: intent.amount,
    recipient: intent.recipient,
    knownRecipients: known,
    blacklist: [],
    perTxLimit: SEND_PER_TX_LIMIT_STROOPS,
    dailyLimit: null,
    dailySpent: spent,
    nightWatchDelay: false,
  });

  if (policy.decision === "delay") {
    assertTransition("policy_gate", "system", "policy_delay"); // đứng yên
    await repo.updateIntent(intent.id, {
      policyDecision: policy.decision,
      policyVersion: policy.policyVersion,
      policyReasons: policy.reasons,
    });
    throw new SendServiceError(409, "POLICY_DELAY", { reasons: policy.reasons });
  }

  if (policy.decision === "require_guardian") {
    assertTransition("policy_gate", "system", "policy_require_guardian"); // → awaiting_guardian
    await repo.updateIntent(intent.id, {
      status: "awaiting_guardian",
      policyDecision: policy.decision,
      policyVersion: policy.policyVersion,
      policyReasons: policy.reasons,
    });
    const expiresAt = expiresAtFrom(new Date(), APPROVAL_TTL_SECONDS);
    const challengeHash = computeChallengeHash({
      intentHash: intent.intentHash ?? "",
      amount: intent.amount,
      recipient: intent.recipient,
      policyVersion: policy.policyVersion,
      expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
    });
    const guardianIds = await repo.activeGuardianIds(wallet.id);
    await repo.createGuardianApprovals({
      intentId: intent.id,
      intentVersion: intent.version,
      challengeHash,
      guardianIds,
      expiresAt,
    });
    await repo.appendIntentAudit({
      walletId: wallet.id,
      kind: "intent.awaiting_guardian",
      actorType: "system",
      payload: { intentId: intent.id, reasons: policy.reasons },
    });
    return { intentId: intent.id, status: "awaiting_guardian", reasons: policy.reasons };
  }

  // allow → build tx transfer, mở awaiting_signature.
  assertTransition("policy_gate", "system", "policy_allow"); // → awaiting_signature
  await repo.updateIntent(intent.id, {
    status: "awaiting_signature",
    policyDecision: policy.decision,
    policyVersion: policy.policyVersion,
    policyReasons: policy.reasons,
  });
  const built = await buildTransfer(
    gateway,
    sacContractId,
    wallet.stellarAddress,
    intent.recipient,
    intent.amount,
  );
  return { intentId: intent.id, status: "awaiting_signature", ...built };
}

async function buildTransfer(
  gateway: SendGateway,
  sacContractId: string,
  from: string,
  to: string,
  amount: bigint,
): Promise<BuiltInvoke> {
  return gateway.build({
    contractId: sacContractId,
    method: "transfer",
    args: transferArgs({ from, to, amount }),
  });
}

/**
 * Owner lấy tx để ký khi intent Ở awaiting_signature (đường guardian: sau khi đủ
 * duyệt intent thành awaiting_signature, owner poll gọi hàm này để build tx ký).
 */
export async function getSignable(
  gateway: SendGateway,
  sacContractId: string,
  input: { intentId: string; userId: string },
): Promise<{ intentId: string } & BuiltInvoke> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId);
  if (intent.status !== "awaiting_signature") {
    throw new SendServiceError(409, "NOT_AWAITING_SIGNATURE");
  }
  if (intent.recipient === null || intent.amount === null) {
    throw new SendServiceError(400, "NOT_A_TRANSFER");
  }
  const built = await buildTransfer(
    gateway,
    sacContractId,
    wallet.stellarAddress,
    intent.recipient,
    intent.amount,
  );
  return { intentId: intent.id, ...built };
}

/**
 * Guardian duyệt intent vượt ngưỡng (off-chain approval_requests). K5 binding +
 * re-evaluate P3 (domain acceptGuardianApproval). Đủ duyệt → intent
 * awaiting_signature; policy đổi lúc re-eval → quay lại awaiting_guardian.
 */
export async function guardianApproveIntent(input: {
  intentId: string;
  userId: string;
  verifiedCall: boolean;
}): Promise<{ nextStatus: string; reasons: string[] }> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  if (intent.recipient === null || intent.amount === null) {
    throw new SendServiceError(400, "NOT_A_TRANSFER");
  }
  const link = await repo.approvalForGuardianUser(intent.id, input.userId);
  if (!link) throw new SendServiceError(403, "NOT_GUARDIAN_OF_INTENT");
  if (link.approval.decision !== "pending") {
    throw new SendServiceError(409, "ALREADY_DECIDED");
  }

  const outcome = acceptGuardianApproval({
    intentStatus: intent.status,
    approvalChallengeHash: link.approval.challengeHash,
    currentBinding: {
      intentHash: intent.intentHash ?? "",
      amount: intent.amount,
      recipient: intent.recipient,
      policyVersion:
        link.approval.intentVersion === intent.version
          ? (intent.policyVersion ?? CURRENT_POLICY_VERSION)
          : CURRENT_POLICY_VERSION,
      expiresAtEpoch: Math.floor(link.approval.expiresAt.getTime() / 1000),
    },
    // Re-eval P3 SAU phê duyệt: guardian ĐÃ clear ngưỡng đã kích hoạt gate này,
    // nên KHÔNG áp lại per-tx-limit (áp lại = vòng lặp vô tận). Re-eval chỉ bắt
    // điều kiện MỚI xuất hiện sau approval — blacklist / night-watch delay (hai
    // subsystem này chưa dựng nên hiện luôn allow); thay đổi amount/recipient đã
    // bị chặn ở K5 binding phía trên, không phải ở đây.
    policy: {
      evaluate: () =>
        evaluatePolicy({
          amount: intent.amount,
          recipient: intent.recipient,
          knownRecipients: intent.recipient ? [intent.recipient] : [],
          blacklist: [],
          perTxLimit: null,
          dailyLimit: null,
          dailySpent: 0n,
          nightWatchDelay: false,
        }),
    },
    wallet: { walletId: intent.walletId, amount: intent.amount, recipient: intent.recipient },
  });

  await repo.markApproval(link.approval.id, "approved", input.verifiedCall);
  await repo.updateIntent(intent.id, { status: outcome.nextStatus });
  await repo.appendIntentAudit({
    walletId: intent.walletId,
    kind: "intent.guardian_approved",
    actorType: "guardian",
    actorId: input.userId,
    payload: { intentId: intent.id, nextStatus: outcome.nextStatus },
  });
  return { nextStatus: outcome.nextStatus, reasons: outcome.reasons };
}

/**
 * Bước 3 — ký + gửi: nhận entry ĐÃ KÝ → whitelist (domain) → sign → submitting →
 * invoke (re-simulate + ví phí ký envelope + submit + poll) → settled | submit_failed.
 */
export async function signAndSubmit(
  gateway: SendGateway,
  sacContractId: string,
  input: { intentId: string; userId: string; signedEntriesXdr: string[] },
): Promise<{ intentId: string; status: string; hash: string }> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId);
  if (intent.recipient === null || intent.amount === null) {
    throw new SendServiceError(400, "NOT_A_TRANSFER");
  }

  const validated = validateSignedTransfer({
    sacContractId,
    walletAddress: wallet.stellarAddress,
    entriesXdr: input.signedEntriesXdr,
    expectedRecipient: intent.recipient,
    expectedAmount: intent.amount,
  });

  // Trạng thái THẬT của intent, không phải hằng số. Bản cũ truyền literal
  // "awaiting_signature" nên `assertTransition` tra một dòng luôn tồn tại và
  // KHÔNG BAO GIỜ ném: ký được cả intent đang chờ người thân duyệt (vượt cổng
  // chính sách) lẫn intent đã `settled` (gửi tiền lần hai).
  assertTransition(intent.status as IntentState, "owner", "sign"); // → submitting (409 nếu sai)
  await repo.updateIntent(intent.id, { status: "submitting" });

  let result: { hash: string; status: string };
  try {
    result = await gateway.invoke({
      contractId: sacContractId,
      method: "transfer",
      args: validated.args,
      authEntries: validated.entries,
    });
  } catch (err) {
    assertTransition("submitting", "system", "submit_fail"); // → submit_failed (retry được)
    await repo.updateIntent(intent.id, { status: "submit_failed" });
    await repo.appendIntentAudit({
      walletId: wallet.id,
      kind: "intent.submit_failed",
      actorType: "system",
      payload: { intentId: intent.id, error: (err as Error).message },
    });
    throw err;
  }

  assertTransition("submitting", "system", "submit_ok"); // → settled
  await repo.updateIntent(intent.id, { status: "settled" });
  await repo.appendIntentAudit({
    walletId: wallet.id,
    kind: "intent.settled",
    actorType: "owner",
    actorId: input.userId,
    payload: { intentId: intent.id, hash: result.hash, status: result.status },
  });
  return { intentId: intent.id, status: "settled", hash: result.hash };
}
