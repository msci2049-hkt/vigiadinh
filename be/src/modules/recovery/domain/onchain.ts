// Tầng THUẦN cho luồng ghi recovery on-chain (PHA 5.2, nâng v2 ở audit P0 2026-07-24)
// — không env/IO, test hermetic. Interface = contracts/recovery-registry (v2, trong
// repo): "wallet" = địa chỉ SMART ACCOUNT (C…) tự đăng ký; initiate chở Signer OZ
// (guardian phê duyệt ĐÚNG khoá mới); finalize xoay khoá BÊN TRONG smart account —
// địa chỉ ví không đổi. Veto = chính ví ký (cancel_recovery(wallet), bỏ arg owner v1).
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

/** Lỗi domain — route map sang 400/409, không leak stack/XDR. */
export class RecoveryOnchainError extends Error {}

function fail(code: string): never {
  throw new RecoveryOnchainError(code);
}

/** action (tên route) → method contract. finalize KHÔNG nằm trong SIGNABLE (không đòi
 * auth người dùng — ai crank cũng được sau timelock, one-shot ở route). */
export const RECOVERY_METHODS = {
  register: "register_wallet",
  initiate: "initiate_recovery",
  approve: "approve_recovery",
  veto: "cancel_recovery",
  finalize: "finalize_recovery",
  addGuardian: "add_guardian",
} as const;
export type RecoveryAction = keyof typeof RECOVERY_METHODS;

/** Method được phép xuất hiện trong entry ĐÃ KÝ nộp về /submit. */
const SIGNABLE_METHODS = new Set<string>([
  RECOVERY_METHODS.register,
  RECOVERY_METHODS.initiate,
  RECOVERY_METHODS.approve,
  RECOVERY_METHODS.veto,
  // Chủ ví ký — wizard mức B thêm TỪNG người bảo hộ bằng tx độc lập, thay vì
  // gom tất cả vào một lần đăng ký (một người chậm không treo cả nhà).
  RECOVERY_METHODS.addGuardian,
]);

/** Bảng Error enum registry v2 (1..16 giữ nguyên v1) + mã smart account (100/101)
 * có thể nổi lên khi finalize/tx của ví — dịch mã #N thành tên đọc được. */
export const CONTRACT_ERROR_NAMES: Record<number, string> = {
  1: "AlreadyRegistered",
  2: "NotRegistered",
  3: "InvalidThreshold",
  4: "TooFewGuardians",
  5: "TooManyGuardians",
  6: "NotAGuardian",
  7: "RecoveryInProgress",
  8: "NoActiveRecovery",
  9: "ThresholdNotMet",
  10: "TimelockNotElapsed",
  11: "AlreadyApproved",
  12: "RecoveryCancelled",
  13: "AlreadyFinalized",
  14: "GuardianExists",
  15: "GuardianNotFound",
  16: "DuplicateGuardian",
  // FamilyWalletError của smart-account (contracts/smart-account) — lộ qua sub-call.
  100: "RecoveryNotConfigured",
  101: "CooldownActive",
  102: "DuplicateRecoveryEntry",
  103: "RegistryAlreadyConfigured",
  104: "NoPendingRegistryChange",
  105: "RegistryChangeNotDue",
  106: "RegistryChangePending",
  107: "NotAuthorizedToCancel",
};

/** `SIMULATION_FAILED:...Error(Contract, #9)...` → `CONTRACT_ERROR:ThresholdNotMet`.
 * Không match → null (caller giữ mã gốc chung chung, log chi tiết server-side). */
export function contractErrorCode(simError: string): string | null {
  const m = simError.match(/Error\(Contract, #(\d+)\)/);
  if (!m) return null;
  const name = CONTRACT_ERROR_NAMES[Number(m[1])];
  return name ? `CONTRACT_ERROR:${name}` : `CONTRACT_ERROR:#${m[1]}`;
}

const addr = (a: string): xdr.ScVal => nativeToScVal(new Address(a));

/** Độ dài key hợp lệ: ed25519 raw 32B · secp256r1 uncompressed 65B (+credential id ≤96B). */
const SIGNER_KEY_MIN = 32;
const SIGNER_KEY_MAX = 96;

/**
 * `Signer::External(verifier, key)` của OZ smart account dạng ScVal
 * (enum tuple-variant → Vec[Symbol, ...fields]). Khoá MỚI đi từ THIẾT BỊ MỚI của
 * người dùng qua guardian — backend chỉ đóng gói, không sinh, không giữ.
 */
export function externalSignerScVal(input: { verifier: string; keyBase64: string }): xdr.ScVal {
  let key: Buffer;
  try {
    key = Buffer.from(input.keyBase64, "base64");
  } catch {
    fail("SIGNER_KEY_NOT_BASE64");
  }
  if (key.length < SIGNER_KEY_MIN || key.length > SIGNER_KEY_MAX) fail("SIGNER_KEY_LENGTH");
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("External"),
    addr(input.verifier),
    xdr.ScVal.scvBytes(key),
  ]);
}

export function registerArgs(input: {
  wallet: string;
  guardians: string[];
  threshold: number;
  timelockSecs: number;
}): xdr.ScVal[] {
  return [
    addr(input.wallet),
    xdr.ScVal.scvVec(input.guardians.map(addr)),
    nativeToScVal(input.threshold, { type: "u32" }),
    nativeToScVal(input.timelockSecs, { type: "u64" }),
  ];
}

export function initiateArgs(input: {
  wallet: string;
  newSignerVerifier: string;
  newSignerKeyBase64: string;
  initiator: string;
}): xdr.ScVal[] {
  return [
    addr(input.wallet),
    externalSignerScVal({ verifier: input.newSignerVerifier, keyBase64: input.newSignerKeyBase64 }),
    addr(input.initiator),
  ];
}

export function approveArgs(input: { wallet: string; guardian: string }): xdr.ScVal[] {
  return [addr(input.wallet), addr(input.guardian)];
}

/** `add_guardian(wallet, new_guardian)` — chủ ví ký. Guardian là ĐỊA CHỈ (ví
 * hợp đồng của chính người bảo hộ), không phải vật liệu passkey: registry cần
 * `require_auth()` để nhận phiếu, mà chỉ Address mới require_auth được. */
export function addGuardianArgs(input: { wallet: string; guardian: string }): xdr.ScVal[] {
  return [addr(input.wallet), addr(input.guardian)];
}

/** v2: veto = `cancel_recovery(wallet)` — chính VÍ ký qua __check_auth, hết arg owner. */
export function vetoArgs(input: { wallet: string }): xdr.ScVal[] {
  return [addr(input.wallet)];
}

export function finalizeArgs(input: { wallet: string }): xdr.ScVal[] {
  return [addr(input.wallet)];
}

/**
 * Địa chỉ NGƯỜI DUYỆT từ THAM SỐ lời gọi đã validate: `initiate_recovery(wallet,
 * new_signer, initiator)` → args[2]; `approve_recovery(wallet, guardian)` → args[1].
 * Source account của tx là VÍ PHÍ dùng chung cho mọi giao dịch — nó KHÔNG nhận
 * dạng được ai, audit tuyệt đối không lấy từ đó. Method khác không chở người
 * duyệt → null (audit bỏ trường, không đoán).
 */
export function actorAddressFromArgs(method: string, args: xdr.ScVal[]): string | null {
  const index =
    method === RECOVERY_METHODS.initiate ? 2 : method === RECOVERY_METHODS.approve ? 1 : null;
  if (index === null) return null;
  const arg = args[index];
  if (!arg || arg.switch() !== xdr.ScValType.scvAddress()) return null;
  return Address.fromScAddress(arg.address()).toString();
}

export type ValidatedSubmission = {
  method: string;
  /** Args lấy từ CHÍNH invocation user đã ký — op dựng lại từ đây, không tin body. */
  args: xdr.ScVal[];
  entries: xdr.SorobanAuthorizationEntry[];
};

/**
 * Validate entries ĐÃ KÝ trước khi ví phí trả tiền submit (an toàn kiểu SEP-45):
 * 1. decode được, credentials PHẢI là address (source-account credentials = ví phí
 *    tự authorize — CẤM: envelope do ví phí ký);
 * 2. mọi entry cùng MỘT rootInvocation, không sub-invocation;
 * 3. contract = registry, method ∈ whitelist, args[0] = đúng ví của request.
 * Chữ ký thật do simulate + on-chain require_auth kiểm — đây là chốt CHÍNH SÁCH.
 */
export function validateSignedSubmission(input: {
  registryContractId: string;
  walletAddress: string;
  entriesXdr: string[];
}): ValidatedSubmission {
  if (input.entriesXdr.length === 0) fail("NO_ENTRIES");
  if (input.entriesXdr.length > 3) fail("TOO_MANY_ENTRIES");

  const entries: xdr.SorobanAuthorizationEntry[] = [];
  for (const b64 of input.entriesXdr) {
    try {
      entries.push(xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64"));
    } catch {
      fail("MALFORMED_ENTRY_XDR");
    }
  }

  let sharedInvocationXdr: string | undefined;
  for (const entry of entries) {
    if (entry.credentials().switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
      fail("CREDENTIALS_NOT_ADDRESS");
    }
    const invocation = entry.rootInvocation();
    const invocationXdr = invocation.toXDR("base64");
    if (sharedInvocationXdr && invocationXdr !== sharedInvocationXdr) {
      fail("INVOCATION_MISMATCH_ACROSS_ENTRIES");
    }
    sharedInvocationXdr = invocationXdr;
    if (invocation.subInvocations().length > 0) fail("SUB_INVOCATIONS_FORBIDDEN");
    const fn = invocation.function();
    if (
      fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()
    ) {
      fail("NOT_CONTRACT_FN");
    }
  }

  const first = entries[0];
  if (!first) fail("NO_ENTRIES");
  const call = first.rootInvocation().function().contractFn();
  if (Address.fromScAddress(call.contractAddress()).toString() !== input.registryContractId) {
    fail("WRONG_CONTRACT");
  }
  const method = call.functionName().toString();
  if (!SIGNABLE_METHODS.has(method)) fail("METHOD_NOT_ALLOWED");
  const args = call.args();
  const walletArg = args[0];
  if (!walletArg || walletArg.switch() !== xdr.ScValType.scvAddress()) fail("WALLET_ARG_MISSING");
  if (Address.fromScAddress(walletArg.address()).toString() !== input.walletAddress) {
    fail("WALLET_MISMATCH");
  }

  return { method, args: [...args], entries };
}
