// CHỐNG KÝ MÙ — giải mã auth entry TRƯỚC khi đưa cho passkey ký, rồi đối chiếu
// với thứ NGƯỜI DÙNG đã nhập/đã thấy trên màn hình.
//
// Vì sao phải có: backend dựng entry, frontend ký entry. Nếu frontend ký bất cứ
// thứ gì backend trả về thì một backend bị chiếm chỉ cần đổi `to`/`amount` là
// người dùng tự tay ký lệnh chuyển sạch ví — hộp thoại passkey của hệ điều hành
// CHỈ hiện "dùng passkey cho <rpId>", không hiện số tiền hay người nhận. Như vậy
// bất biến số 1 ("backend bị chiếm → không ai mất tiền") vỡ.
//
// K2 (challenge dẫn xuất từ entry) KHÔNG cứu được ca này: nó ràng chữ ký vào
// entry ĐÃ ký, chứ không nói entry đó có đúng thứ người dùng thấy hay không.
//
// LUẬT DÙNG: mọi giá trị đem ra so phải là INPUT CỤC BỘ của người dùng (state
// trong màn hình), TUYỆT ĐỐI không phải giá trị backend echo lại — so bản sao
// của backend với bản gốc của backend thì luôn khớp và chẳng chứng minh gì.
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";

/** Entry không khớp thứ người dùng thấy → dừng TRƯỚC khi ký. */
export class BlindSignError extends Error {
  readonly code: BlindSignCode;
  constructor(code: BlindSignCode) {
    super(code);
    this.name = "BlindSignError";
    this.code = code;
  }
}

export type BlindSignCode =
  | "ENTRY_MALFORMED"
  | "ENTRY_HAS_SUBINVOCATIONS"
  | "ENTRY_NOT_CONTRACT_FN"
  | "ENTRY_WRONG_CONTRACT"
  | "ENTRY_WRONG_METHOD"
  | "ENTRY_ARG_SHAPE"
  | "ENTRY_WRONG_SOURCE"
  | "ENTRY_WRONG_RECIPIENT"
  | "ENTRY_WRONG_AMOUNT"
  | "ENTRY_WRONG_GUARDIAN"
  | "ENTRY_WRONG_GUARDIAN_SET"
  | "ENTRY_WRONG_THRESHOLD"
  | "ENTRY_WRONG_TIMELOCK";

export type EntryCall = {
  contract: string;
  method: string;
  args: xdr.ScVal[];
};

/**
 * Giải mã `(contract, method, args)` của entry. Từ chối luôn sub-invocation:
 * entry hợp lệ của ta luôn phẳng, còn sub-invocation là chỗ giấu lệnh thứ hai
 * mà màn hình không hề hiện.
 */
export function decodeEntryCall(entry: string | xdr.SorobanAuthorizationEntry): EntryCall {
  let decoded: xdr.SorobanAuthorizationEntry;
  if (typeof entry === "string") {
    try {
      decoded = xdr.SorobanAuthorizationEntry.fromXDR(entry, "base64");
    } catch {
      throw new BlindSignError("ENTRY_MALFORMED");
    }
  } else {
    decoded = entry;
  }
  const invocation = decoded.rootInvocation();
  if (invocation.subInvocations().length > 0) {
    throw new BlindSignError("ENTRY_HAS_SUBINVOCATIONS");
  }
  const fn = invocation.function();
  if (fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()) {
    throw new BlindSignError("ENTRY_NOT_CONTRACT_FN");
  }
  const call = fn.contractFn();
  return {
    contract: Address.fromScAddress(call.contractAddress()).toString(),
    method: call.functionName().toString(),
    args: [...call.args()],
  };
}

/**
 * Chốt TỐI THIỂU khi ta chưa biết trước địa chỉ contract: pin TÊN HÀM.
 *
 * Đủ để chặn biến luồng đăng nhập thành "máy ký thuê": muốn rút tiền thì phải có
 * entry `transfer` trên SAC, muốn đổi quyền thì phải có `add_guardian`/
 * `register_wallet` — tên hàm khác là chối ngay. Đường vòng duy nhất còn lại là
 * nhét lệnh thật vào sub-invocation, mà `decodeEntryCall` đã cấm.
 */
export function assertMethodOnly(
  entry: string | xdr.SorobanAuthorizationEntry,
  method: string,
): EntryCall {
  const call = decodeEntryCall(entry);
  if (call.method !== method) throw new BlindSignError("ENTRY_WRONG_METHOD");
  return call;
}

/** Entry phải gọi ĐÚNG contract + ĐÚNG hàm — chốt chung cho mọi luồng ký. */
export function assertCall(
  entry: string | xdr.SorobanAuthorizationEntry,
  expected: { contract: string; method: string },
): EntryCall {
  const call = decodeEntryCall(entry);
  if (call.contract !== expected.contract) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
  if (call.method !== expected.method) throw new BlindSignError("ENTRY_WRONG_METHOD");
  return call;
}

function addressAt(args: xdr.ScVal[], index: number): string {
  const arg = args[index];
  if (!arg || arg.switch() !== xdr.ScValType.scvAddress()) {
    throw new BlindSignError("ENTRY_ARG_SHAPE");
  }
  return Address.fromScAddress(arg.address()).toString();
}

function bigintAt(args: xdr.ScVal[], index: number): bigint {
  const arg = args[index];
  if (!arg) throw new BlindSignError("ENTRY_ARG_SHAPE");
  const native = scValToNative(arg);
  if (typeof native === "bigint") return native;
  if (typeof native === "number") return BigInt(native);
  throw new BlindSignError("ENTRY_ARG_SHAPE");
}

function addressVecAt(args: xdr.ScVal[], index: number): string[] {
  const arg = args[index];
  if (!arg || arg.switch() !== xdr.ScValType.scvVec()) {
    throw new BlindSignError("ENTRY_ARG_SHAPE");
  }
  const items = arg.vec() ?? [];
  return items.map((item) => {
    if (item.switch() !== xdr.ScValType.scvAddress()) {
      throw new BlindSignError("ENTRY_ARG_SHAPE");
    }
    return Address.fromScAddress(item.address()).toString();
  });
}

/**
 * `transfer(from, to, amount)` trên SAC — luồng GỬI TIỀN.
 * `to` và `amount` phải là thứ người dùng vừa gõ, không phải thứ backend trả về.
 */
export function assertTransferEntry(
  entry: string | xdr.SorobanAuthorizationEntry,
  expected: { sac: string; from: string; to: string; amount: bigint },
): void {
  const call = assertCall(entry, { contract: expected.sac, method: "transfer" });
  if (addressAt(call.args, 0) !== expected.from) throw new BlindSignError("ENTRY_WRONG_SOURCE");
  if (addressAt(call.args, 1) !== expected.to) throw new BlindSignError("ENTRY_WRONG_RECIPIENT");
  if (bigintAt(call.args, 2) !== expected.amount) throw new BlindSignError("ENTRY_WRONG_AMOUNT");
}

/** `add_guardian(wallet, new_guardian)` — địa chỉ người bảo hộ phải đúng người đang thêm. */
export function assertAddGuardianEntry(
  entry: string | xdr.SorobanAuthorizationEntry,
  expected: { registry: string; wallet: string; guardian: string },
): void {
  const call = assertCall(entry, { contract: expected.registry, method: "add_guardian" });
  if (addressAt(call.args, 0) !== expected.wallet) throw new BlindSignError("ENTRY_WRONG_SOURCE");
  if (addressAt(call.args, 1) !== expected.guardian) {
    throw new BlindSignError("ENTRY_WRONG_GUARDIAN");
  }
}

/**
 * `register_wallet(wallet, guardians, threshold, timelock_secs)`.
 * Đăng ký là MỘT LẦN (contract chối lần hai — `AlreadyRegistered`), nên ký nhầm
 * danh sách người bảo hộ ở đây là hỏng vĩnh viễn, không sửa lại được.
 */
export function assertRegisterWalletEntry(
  entry: string | xdr.SorobanAuthorizationEntry,
  expected: {
    registry: string;
    wallet: string;
    /** Người bảo hộ chủ ví ĐÃ THẤY trong danh sách lời mời của mình. */
    allowedGuardians: string[];
    threshold: number;
    timelockSecs: number;
  },
): void {
  const call = assertCall(entry, { contract: expected.registry, method: "register_wallet" });
  if (addressAt(call.args, 0) !== expected.wallet) throw new BlindSignError("ENTRY_WRONG_SOURCE");
  // Kiểm CHỨA, không kiểm bằng: thứ tự do backend xếp và có thể có người bảo hộ
  // hợp lệ đến từ đường khác. Điều PHẢI đúng là: không có địa chỉ NÀO chủ ví
  // chưa từng thấy lọt vào danh sách sắp đóng băng trên chain.
  const allowed = new Set(expected.allowedGuardians);
  const guardians = addressVecAt(call.args, 1);
  if (guardians.length === 0) throw new BlindSignError("ENTRY_WRONG_GUARDIAN_SET");
  if (guardians.some((g) => !allowed.has(g))) {
    throw new BlindSignError("ENTRY_WRONG_GUARDIAN_SET");
  }
  if (bigintAt(call.args, 2) !== BigInt(expected.threshold)) {
    throw new BlindSignError("ENTRY_WRONG_THRESHOLD");
  }
  if (bigintAt(call.args, 3) !== BigInt(expected.timelockSecs)) {
    throw new BlindSignError("ENTRY_WRONG_TIMELOCK");
  }
}
