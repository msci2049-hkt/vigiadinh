// Service GỬI TIỀN (PHA 6 SEND) — lái intent qua pipeline PHA 3, KHÔNG gọi thẳng
// SAC từ màn nhập. Custody bất biến: BE build+simulate, FE ký entry ví bằng
// passkey, ví phí ký ENVELOPE. Đường ký = passkey → __check_auth → verifier →
// transfer trong MỘT tx (chuỗi hai-nửa, đóng rủi ro kỹ thuật lớn nhất còn lại).
import type { xdr } from "@stellar/stellar-sdk";
import { effectiveLimits } from "@/modules/wallets";
import { assertSponsorshipAllowed, FEE_CAP_STROOPS } from "@/services/stellar/fee-policy";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import type { IntentState, PolicyReasonCode } from "@/shared-contract/intent";
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
import { DRAFT_TTL_SECONDS, expiresAtFrom } from "../../domain/ttl";
import { guardianOnchainKeysForWallet } from "../../infra/approvals.repository";
import * as repo from "../../infra/intents.repository";
import { notifyGuardiansApprovalRequested, notifyOwnerGuardianDecision } from "./notify";

/** Cửa sổ hạn mức ngày = ROLLING 24h (A4) — không phải ngày lịch UTC: 23:50 gửi
 * đầy hạn mức, 00:01 gửi tiếp được là lỗ, và người dùng lệch múi giờ UTC thấy
 * "ngày" reset giữa trưa. */
const DAILY_WINDOW_MS = 24 * 3_600_000;

/** Hai tập người nhận, GIỮ RIÊNG (lô vá cửa hậu 2026-07-30).
 *
 * Bản cũ trả về union của hai tập này và policy v2 dùng union đó làm cổng miễn
 * `per_tx` — nghĩa là một giao dịch mồi 1 stroop mua được đúng thứ mà guardian
 * phải ký cam kết on-chain mới có. Giữ riêng ở đây để engine v3 tự chọn tập nào
 * mở cổng nào: `guardians` mở `per_tx`, `settled` chỉ đổi câu chữ cảnh báo. */
type RecipientFamiliarity = {
  /** Địa chỉ đã gửi thành công ≥1 lần — CHỈ dùng cho cảnh báo mềm. */
  settled: string[];
  /** Địa chỉ on-chain của guardian đang hiệu lực — cổng miễn `per_tx` duy nhất. */
  guardians: string[];
};

async function recipientFamiliarity(walletId: string): Promise<RecipientFamiliarity> {
  const [settled, guardians] = await Promise.all([
    repo.knownRecipients(walletId),
    guardianOnchainKeysForWallet(walletId),
  ]);
  return { settled, guardians };
}

/** Cờ cảnh báo mềm C5 của màn xác nhận — "đã từng gửi HOẶC là người trông ví".
 * KHÁC hoàn toàn cổng chính sách: đây chỉ quyết định hiện hay không hiện dòng
 * "bạn chưa từng gửi cho địa chỉ này". */
function isFamiliar(familiarity: RecipientFamiliarity, recipient: string): boolean {
  return familiarity.settled.includes(recipient) || familiarity.guardians.includes(recipient);
}

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
    /** Trần phí per-tx — ví phí không ký tx vượt trần (B-SEC-3 hàng rào 3). */
    maxFeeStroops?: number;
  }): Promise<{ hash: string; status: string }>;
  read(input: { contractId: string; method: string; args: xdr.ScVal[] }): Promise<unknown>;
};

/**
 * @param scopeWalletId scope của session passkey (`activeWalletId`) — session ký
 * bằng passkey ví A không được HÀNH ĐỘNG trên ví B của cùng tài khoản (lô
 * passkey-là-chìa-khoá 29/07, xem lib/wallet-scope). `null`/`undefined` = session
 * email/OTP, không scope — hành vi cũ giữ nguyên, test cũ không phải đổi.
 */
async function requireOwnedWallet(walletId: string, userId: string, scopeWalletId?: string | null) {
  const wallet = await repo.walletById(walletId);
  if (!wallet) throw new SendServiceError(404, "WALLET_NOT_FOUND");
  if (wallet.userId !== userId) throw new SendServiceError(403, "NOT_OWNER");
  if (scopeWalletId && scopeWalletId !== wallet.id) {
    // 403 mã riêng: người này LÀ chủ ví, chỉ cầm nhầm chìa của ví khác.
    throw new SendServiceError(403, "WALLET_OUT_OF_SCOPE");
  }
  return wallet;
}

/** Đọc số dư ví trên SAC (view) — bigint stroops. */
export async function readBalance(
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
  /** C5 — địa chỉ ĐÃ quen (từng gửi thành công / guardian của ví)? false →
   * màn xác nhận hiện cảnh báo MỀM "bạn chưa từng gửi cho địa chỉ này". */
  knownRecipient: boolean;
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
    /** Scope ví của session passkey — xem requireOwnedWallet. */
    sessionWalletScope?: string | null;
  },
): Promise<ReviewResult> {
  const wallet = await requireOwnedWallet(input.walletId, input.userId, input.sessionWalletScope);
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

  const knownRecipient = isFamiliar(await recipientFamiliarity(wallet.id), input.recipient);

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
      knownRecipient,
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
    knownRecipient,
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
  input: { intentId: string; userId: string; sessionWalletScope?: string | null },
): Promise<ConfirmResult> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId, input.sessionWalletScope);
  if (intent.recipient === null || intent.amount === null) {
    throw new SendServiceError(400, "NOT_A_TRANSFER");
  }

  assertTransition(intent.status as IntentState, "owner", "confirm"); // → policy_gate (409 nếu sai state)
  await repo.updateIntent(intent.id, { status: "policy_gate" });

  // A3+A4: ngưỡng THẬT của ví (wallet_policies, fallback default) + cửa sổ
  // rolling 24h — không còn hằng số env, không còn ngày lịch UTC.
  const since = new Date(Date.now() - DAILY_WINDOW_MS);
  const [familiarity, spent, limits] = await Promise.all([
    recipientFamiliarity(wallet.id),
    repo.dailySpent(wallet.id, since),
    effectiveLimits(wallet.id),
  ]);
  const policy = evaluatePolicy({
    amount: intent.amount,
    recipient: intent.recipient,
    knownRecipients: familiarity.settled,
    guardianAddresses: familiarity.guardians,
    blacklist: [],
    perTxLimit: limits.perTxLimit,
    dailyLimit: limits.dailyLimit,
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
    // TTL phiếu = TTL intent (A6): phiếu KHÔNG được sống lâu hơn lệnh — bản cũ
    // phiếu 48h > intent 24h nghĩa là guardian còn thấy phiếu của lệnh đã chết.
    const expiresAt = intent.expiresAt ?? expiresAtFrom(new Date(), DRAFT_TTL_SECONDS);
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
    // A5 — chỗ đứt cũ nằm ngay đây: ghi DB + audit xong rồi return im lặng.
    // Giờ báo từng guardian (email + sse). Fire-and-forget — notify tự nuốt lỗi.
    await notifyGuardiansApprovalRequested({
      walletId: wallet.id,
      amount: intent.amount,
      recipient: intent.recipient,
      expiresAt,
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
  input: { intentId: string; userId: string; sessionWalletScope?: string | null },
): Promise<{ intentId: string } & BuiltInvoke> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId, input.sessionWalletScope);
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
  /** Mặc định "approved" — DTO đã default, client cũ không gửi trường này. */
  decision?: "approved" | "rejected";
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

  // TỪ CHỐI: không cần K5 binding (chối luôn an toàn — tiền không đi đâu),
  // nhưng vẫn đi qua state machine: awaiting_guardian → rejected (guardian).
  if (input.decision === "rejected") {
    assertTransition(
      intent.status as Parameters<typeof assertTransition>[0],
      "guardian",
      "guardian_reject",
    );
    await repo.markApproval(link.approval.id, "rejected", input.verifiedCall);
    await repo.updateIntent(intent.id, { status: "rejected" });
    await repo.appendIntentAudit({
      walletId: intent.walletId,
      kind: "intent.guardian_rejected",
      actorType: "guardian",
      actorId: input.userId,
      payload: { intentId: intent.id },
    });
    await notifyOwnerGuardianDecision({ walletId: intent.walletId, decision: "rejected" });
    return { nextStatus: "rejected", reasons: [] };
  }

  // Context THẬT cho re-eval (A5) — cùng nguồn với confirmSend: ngưỡng của ví,
  // chi tiêu rolling 24h, người quen (đã gửi + guardian).
  const since = new Date(Date.now() - DAILY_WINDOW_MS);
  const [familiarity, spent, limits] = await Promise.all([
    recipientFamiliarity(intent.walletId),
    repo.dailySpent(intent.walletId, since),
    effectiveLimits(intent.walletId),
  ]);

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
    // Re-eval P3 SAU phê duyệt — A5 lô policy: chạy engine với CONTEXT THẬT
    // (ngưỡng thật của ví, chi tiêu rolling 24h thật, người quen thật) thay vì
    // context rỗng luôn-allow của bản cũ. Chống vòng lặp vô tận: reason mà
    // guardian ĐÃ clear (policyReasons ghi trên intent lúc vào awaiting_guardian)
    // được trừ ra — chỉ điều kiện MỚI xuất hiện sau approval (vd nhiều lệnh khác
    // settle làm vượt daily, blacklist thêm sau) mới bật ngược về awaiting_guardian.
    policy: {
      evaluate: () => {
        const evaluated = evaluatePolicy({
          amount: intent.amount,
          recipient: intent.recipient,
          knownRecipients: familiarity.settled,
          guardianAddresses: familiarity.guardians,
          blacklist: [],
          perTxLimit: limits.perTxLimit,
          dailyLimit: limits.dailyLimit,
          dailySpent: spent,
          nightWatchDelay: false,
        });
        if (evaluated.decision === "allow") return evaluated;
        // policyReasons là jsonb — normalize về string[] trước khi so.
        const cleared = new Set<string>(
          Array.isArray(intent.policyReasons) ? (intent.policyReasons as string[]) : [],
        );
        const fresh: PolicyReasonCode[] = evaluated.reasons.filter((r) => !cleared.has(r));
        if (fresh.length === 0) {
          return {
            decision: "allow" as const,
            policyVersion: evaluated.policyVersion,
            reasons: [],
          };
        }
        return { ...evaluated, reasons: fresh };
      },
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
  // Đủ duyệt → chủ ví ký được rồi — báo họ (approval.approved). Re-eval bật
  // ngược về awaiting_guardian thì KHÔNG báo "đã duyệt" (chưa xong).
  if (outcome.nextStatus === "awaiting_signature") {
    await notifyOwnerGuardianDecision({ walletId: intent.walletId, decision: "approved" });
  }
  return { nextStatus: outcome.nextStatus, reasons: outcome.reasons };
}

/**
 * Bước 3 — ký + gửi: nhận entry ĐÃ KÝ → whitelist (domain) → sign → submitting →
 * invoke (re-simulate + ví phí ký envelope + submit + poll) → settled | submit_failed.
 */
export async function signAndSubmit(
  gateway: SendGateway,
  sacContractId: string,
  /**
   * Registry khôi phục — CHỈ dùng để gác chính sách ví phí (`is_registered`), không
   * tham gia vào tx transfer. Truyền tường minh thay vì đọc env trong service để
   * tầng này vẫn thuần/test được (luật module: service không đụng env).
   */
  registryContractId: string,
  input: {
    intentId: string;
    userId: string;
    signedEntriesXdr: string[];
    sessionWalletScope?: string | null;
  },
): Promise<{ intentId: string; status: string; hash: string }> {
  const intent = await repo.intentById(input.intentId);
  if (!intent) throw new SendServiceError(404, "INTENT_NOT_FOUND");
  const wallet = await requireOwnedWallet(intent.walletId, input.userId, input.sessionWalletScope);
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
  // B-SEC-3 hàng rào 1 — gác TRƯỚC khi đổi trạng thái intent: chối ở đây thì intent
  // vẫn nguyên `awaiting_signature`, người dùng ký lại được sau khi đăng ký ví. Gác
  // sau `submitting` là đẩy intent vào ngõ cụt vì một lỗi cấu hình.
  await assertSponsorshipAllowed({
    read: gateway.read,
    registryContractId,
    walletAddress: wallet.stellarAddress,
    method: "transfer",
  });

  assertTransition(intent.status as IntentState, "owner", "sign"); // → submitting (409 nếu sai)
  await repo.updateIntent(intent.id, { status: "submitting" });

  let result: { hash: string; status: string };
  try {
    result = await gateway.invoke({
      contractId: sacContractId,
      method: "transfer",
      args: validated.args,
      authEntries: validated.entries,
      maxFeeStroops: FEE_CAP_STROOPS,
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
