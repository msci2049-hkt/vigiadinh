// Service luồng ghi recovery on-chain (PHA 5.2) — nghiệp vụ TÁCH gateway chain
// (tiêm được: test hermetic dùng fake, e2e dùng gateway thật qua services/stellar).
// Bất biến custody: BE KHÔNG ký hộ người dùng — build trả entries cho FE ký,
// submit chỉ validate entry đã ký + ví phí ký ENVELOPE (trả phí, không giữ quyền).
import type { xdr } from "@stellar/stellar-sdk";
import { assertSponsorshipAllowed, FEE_CAP_STROOPS } from "@/services/stellar/fee-policy";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import {
  addGuardianArgs,
  approveArgs,
  finalizeArgs,
  initiateArgs,
  RECOVERY_METHODS,
  type RecoveryAction,
  registerArgs,
  validateSignedSubmission,
  vetoArgs,
} from "../../domain/onchain";
import * as repo from "../../infra/recovery.repository";

/** Lỗi nghiệp vụ có status HTTP — handler map thẳng, không đoán. */
export class RecoveryActionError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    code: string,
  ) {
    super(code);
  }
}

export type OnchainGateway = {
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

export type BuildableAction = Exclude<RecoveryAction, "finalize">;

async function requireWallet(walletId: string) {
  const wallet = await repo.walletById(walletId);
  if (!wallet) throw new RecoveryActionError(404, "WALLET_NOT_FOUND");
  return wallet;
}

async function requireGuardian(walletId: string, userId: string): Promise<string> {
  const guardian = await repo.guardianOfWalletForUser(walletId, userId);
  if (!guardian) throw new RecoveryActionError(403, "NOT_GUARDIAN");
  if (!guardian.onchainKey) throw new RecoveryActionError(409, "GUARDIAN_KEY_MISSING");
  return guardian.onchainKey;
}

/** Vai trò của user với ví — cho membership check + actorType audit. */
async function memberRole(
  walletId: string,
  userId: string,
): Promise<{ wallet: Awaited<ReturnType<typeof requireWallet>>; role: "owner" | "guardian" }> {
  const wallet = await requireWallet(walletId);
  if (wallet.userId === userId) return { wallet, role: "owner" };
  const guardian = await repo.guardianOfWalletForUser(walletId, userId);
  if (guardian) return { wallet, role: "guardian" };
  throw new RecoveryActionError(403, "NOT_WALLET_MEMBER");
}

/**
 * Build + simulate MỘT action → tx chưa ký + auth entries cho FE ký.
 * Gate BE theo vai trò (contract vẫn cưỡng chế lại bằng require_auth on-chain):
 * initiate/approve = guardian của ví · veto/register/addGuardian = chủ ví.
 */
export async function buildRecoveryAction(
  gateway: OnchainGateway,
  registryContractId: string,
  input: {
    action: BuildableAction;
    walletId: string;
    userId: string;
    newSignerVerifier?: string;
    newSignerKey?: string;
    /** Chỉ addGuardian: địa chỉ ví hợp đồng của người bảo hộ. */
    guardianAddress?: string;
  },
): Promise<{ action: BuildableAction; walletId: string } & BuiltInvoke> {
  const wallet = await requireWallet(input.walletId);
  let args: xdr.ScVal[];

  switch (input.action) {
    case "initiate": {
      const initiator = await requireGuardian(wallet.id, input.userId);
      if (!input.newSignerVerifier || !input.newSignerKey) {
        throw new RecoveryActionError(400, "NEW_SIGNER_REQUIRED");
      }
      args = initiateArgs({
        wallet: wallet.stellarAddress,
        newSignerVerifier: input.newSignerVerifier,
        newSignerKeyBase64: input.newSignerKey,
        initiator,
      });
      break;
    }
    case "approve": {
      const guardian = await requireGuardian(wallet.id, input.userId);
      args = approveArgs({ wallet: wallet.stellarAddress, guardian });
      break;
    }
    case "veto": {
      if (wallet.userId !== input.userId) throw new RecoveryActionError(403, "NOT_OWNER");
      // v2: veto = cancel_recovery(wallet) — CHÍNH VÍ ký (địa chỉ ví không đổi
      // sau khôi phục, khỏi tra owner từ chain như v1).
      args = vetoArgs({ wallet: wallet.stellarAddress });
      break;
    }
    case "register": {
      if (wallet.userId !== input.userId) throw new RecoveryActionError(403, "NOT_OWNER");
      const guardianKeys = await repo.activeGuardianKeys(wallet.id);
      if (guardianKeys.length < 2) throw new RecoveryActionError(409, "TOO_FEW_GUARDIAN_KEYS");
      args = registerArgs({
        wallet: wallet.stellarAddress,
        guardians: guardianKeys,
        threshold: wallet.threshold,
        timelockSecs: wallet.timelockSecs,
      });
      break;
    }
    case "addGuardian": {
      // Wizard mức B: người bảo hộ nhận lời SAU khi ví đã đăng ký được thêm
      // bằng MỘT tx riêng. Không gom vào register — gom nghĩa là một người
      // chậm treo cả nhà, và không có đường lùi giữa chừng.
      if (wallet.userId !== input.userId) throw new RecoveryActionError(403, "NOT_OWNER");
      if (!input.guardianAddress) {
        throw new RecoveryActionError(400, "GUARDIAN_ADDRESS_REQUIRED");
      }
      args = addGuardianArgs({
        wallet: wallet.stellarAddress,
        guardian: input.guardianAddress,
      });
      break;
    }
  }

  const built = await gateway.build({
    contractId: registryContractId,
    method: RECOVERY_METHODS[input.action],
    args,
  });
  return { action: input.action, walletId: wallet.id, ...built };
}

/**
 * Nộp entries ĐÃ KÝ → validate whitelist (domain) → invoke (re-simulate + ví phí
 * ký envelope + submit + poll) → audit hành động người thật. Mirror trạng thái
 * KHÔNG ghi ở đây — indexer là người ghi duy nhất (nguồn sự thật = chain).
 */
export async function submitRecoveryAction(
  gateway: OnchainGateway,
  registryContractId: string,
  input: { walletId: string; userId: string; signedEntriesXdr: string[] },
): Promise<{ method: string; hash: string; status: string }> {
  const { wallet, role } = await memberRole(input.walletId, input.userId);
  const validated = validateSignedSubmission({
    registryContractId,
    walletAddress: wallet.stellarAddress,
    entriesXdr: input.signedEntriesXdr,
  });
  // B-SEC-3 hàng rào 1: whitelist contract + method (ở trên) CHƯA đủ — nó chỉ nói
  // "tx này hình dạng đúng", không nói "ví này đáng để ví phí trả hộ". Không có
  // cổng dưới, bất kỳ tài khoản app nào tạo một ví C… rồi bơm entry hợp-hình-dạng
  // là ví phí trả tới lúc cạn. Đặt TRƯỚC `invoke` để ví phí chưa ký gì khi chối.
  await assertSponsorshipAllowed({
    read: gateway.read,
    registryContractId,
    walletAddress: wallet.stellarAddress,
    method: validated.method,
  });
  const result = await gateway.invoke({
    contractId: registryContractId,
    method: validated.method,
    args: validated.args,
    authEntries: validated.entries,
    maxFeeStroops: FEE_CAP_STROOPS,
  });
  await repo.appendOnchainAudit({
    walletId: wallet.id,
    kind: "recovery.onchain.submitted",
    actorType: role,
    actorId: input.userId,
    payload: { method: validated.method, hash: result.hash, status: result.status },
  });
  return { method: validated.method, ...result };
}

/**
 * Finalize = one-shot: contract KHÔNG đòi auth người dùng (interface từ chain —
 * không có arg actor), timelock + threshold cưỡng chế on-chain. Simulation trả
 * auth entries ngoài dự kiến → dừng (không để ví phí authorize hộ thứ lạ).
 */
export async function finalizeRecovery(
  gateway: OnchainGateway,
  registryContractId: string,
  input: { walletId: string; userId: string },
): Promise<{ method: string; hash: string; status: string }> {
  const { wallet, role } = await memberRole(input.walletId, input.userId);
  const args = finalizeArgs({ wallet: wallet.stellarAddress });
  const built = await gateway.build({
    contractId: registryContractId,
    method: RECOVERY_METHODS.finalize,
    args,
  });
  if (built.authEntriesXdr.length > 0) {
    throw new RecoveryActionError(409, "FINALIZE_REQUIRES_AUTH_UNEXPECTED");
  }
  // finalize KHÔNG đòi auth người dùng (ai crank cũng được sau timelock) → đây là
  // cửa ví phí trả hộ mà KHÔNG có chữ ký người dùng nào chắn phía trước. Hàng rào
  // `is_registered` vì thế còn cần hơn ở đây: ví chưa đăng ký thì không có yêu cầu
  // khôi phục nào để finalize, mọi lệnh gọi như vậy chỉ là đốt phí.
  await assertSponsorshipAllowed({
    read: gateway.read,
    registryContractId,
    walletAddress: wallet.stellarAddress,
    method: RECOVERY_METHODS.finalize,
  });
  const result = await gateway.invoke({
    contractId: registryContractId,
    method: RECOVERY_METHODS.finalize,
    args,
    authEntries: [],
    maxFeeStroops: FEE_CAP_STROOPS,
  });
  // THU HỒI phiên cũ (closeout §4) — finalize là đúng lúc khoá bên trong ví đổi.
  // Sau bước này thiết bị cũ hết KÝ được (on-chain cưỡng chế), nhưng JWT ví đã phát
  // vẫn tự chứng tới hết `exp` nếu không tăng số hiệu. Tăng TRƯỚC khi ghi nhật ký
  // để nhật ký chở luôn số hiệu mới, và chỉ tăng khi tx đã SUCCESS — xoay khoá thất
  // bại mà vẫn giết phiên là làm cả nhà đăng xuất vô cớ.
  const newVersion =
    result.status === "SUCCESS" ? await repo.bumpWalletJwtVersion(wallet.id) : null;

  await repo.appendOnchainAudit({
    walletId: wallet.id,
    kind: "recovery.onchain.submitted",
    actorType: role,
    actorId: input.userId,
    payload: {
      method: RECOVERY_METHODS.finalize,
      hash: result.hash,
      status: result.status,
      ...(newVersion === null ? {} : { jwtVersion: newVersion }),
    },
  });
  return { method: RECOVERY_METHODS.finalize, ...result };
}
