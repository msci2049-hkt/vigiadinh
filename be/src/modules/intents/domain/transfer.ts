// Tầng THUẦN gửi tiền từ ví HỢP ĐỒNG (PHA 6 SEND) — không env/IO, test hermetic.
// Ví C… KHÔNG dùng payment op (docs Stellar); gửi = invoke `transfer(from,to,amount)`
// trên SAC (RESEARCH-LOG 2026-07-24 SEND). auth `from.require_auth()` đi qua
// __check_auth → verifier passkey — CHÍNH chuỗi đã chứng minh on-chain ở audit P0.
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

export class SendError extends Error {}

function fail(code: string): never {
  throw new SendError(code);
}

const addr = (a: string): xdr.ScVal => nativeToScVal(new Address(a));

/** Địa chỉ Stellar hợp lệ làm người nhận: G (classic) hoặc C (contract). */
const STELLAR_ADDRESS = /^[GC][A-Z2-7]{55}$/;

export function isStellarAddress(a: string): boolean {
  return STELLAR_ADDRESS.test(a);
}

/** transfer(from: Address, to: Address, amount: i128) — thứ tự args chuẩn SAC. */
export function transferArgs(input: { from: string; to: string; amount: bigint }): xdr.ScVal[] {
  if (!isStellarAddress(input.from) || !isStellarAddress(input.to)) fail("BAD_ADDRESS");
  if (input.amount <= 0n) fail("BAD_AMOUNT");
  return [addr(input.from), addr(input.to), nativeToScVal(input.amount, { type: "i128" })];
}

/** balance(id: Address) — view, đọc số dư ví trước khi tạo tx ký (chặn trước biometric). */
export function balanceArgs(id: string): xdr.ScVal[] {
  return [addr(id)];
}

export type ValidatedTransfer = {
  args: xdr.ScVal[];
  entries: xdr.SorobanAuthorizationEntry[];
};

/**
 * Validate entries ĐÃ KÝ của luồng gửi TRƯỚC khi ví phí trả tiền submit (cùng
 * triết lý whitelist recovery §5.2): entry phải là invoke `transfer` trên ĐÚNG
 * SAC, `from` = đúng ví của intent, credentials address (không source-account),
 * không sub-invocation. Chữ ký thật do re-simulate + on-chain __check_auth kiểm —
 * đây là chốt CHÍNH SÁCH (ví phí không authorize hộ thứ lạ).
 */
export function validateSignedTransfer(input: {
  sacContractId: string;
  walletAddress: string;
  entriesXdr: string[];
}): ValidatedTransfer {
  if (input.entriesXdr.length === 0) fail("NO_ENTRIES");
  if (input.entriesXdr.length > 2) fail("TOO_MANY_ENTRIES");

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
    if (
      invocation.function().switch() !==
      xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()
    ) {
      fail("NOT_CONTRACT_FN");
    }
  }

  const first = entries[0];
  if (!first) fail("NO_ENTRIES");
  const call = first.rootInvocation().function().contractFn();
  if (Address.fromScAddress(call.contractAddress()).toString() !== input.sacContractId) {
    fail("WRONG_CONTRACT");
  }
  if (call.functionName().toString() !== "transfer") fail("METHOD_NOT_ALLOWED");
  const args = call.args();
  const fromArg = args[0];
  if (!fromArg || fromArg.switch() !== xdr.ScValType.scvAddress()) fail("FROM_ARG_MISSING");
  if (Address.fromScAddress(fromArg.address()).toString() !== input.walletAddress) {
    fail("FROM_MISMATCH");
  }
  return { args: [...args], entries };
}
