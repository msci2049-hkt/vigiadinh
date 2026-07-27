// Dựng + validate SorobanAuthorizationEntries cho SEP-45 — THUẦN XDR, không env/IO
// (test hermetic được). Wire format theo spec: `authorization_entries` là MỘT chuỗi
// base64 XDR của cả vector — đúng type `xdr.SorobanAuthorizationEntries` SDK có sẵn.
import { Address, authorizeEntry, type Keypair, xdr } from "@stellar/stellar-sdk";
import type { ChallengeArgs, Sep45Config, ValidatedChallenge } from "./types";

export const WEB_AUTH_FN = "web_auth_verify";

/** Lỗi domain — route map sang 400 với message này (không leak stack). */
export class Sep45ValidationError extends Error {}

function fail(code: string): never {
  throw new Sep45ValidationError(code);
}

// ---------- vector XDR encode/decode ----------

// LƯU Ý bản đã cài (js-xdr 4.0.0): `SorobanAuthorizationEntries.toXDR(entries)` LỖI
// ("value is not array") — instance toXDR(format) của js-xdr tự serialize CHÍNH NÓ,
// không nhận value như .d.ts của SDK khai. Encode tay đúng khung VarArray XDR
// (uint32 count ++ từng entry); decode thì fromXDR dùng được (đã có test roundtrip).
export function encodeEntriesXdr(entries: xdr.SorobanAuthorizationEntry[]): string {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(entries.length, 0);
  return Buffer.concat([count, ...entries.map((e) => e.toXDR())]).toString("base64");
}

export function decodeEntriesXdr(base64: string): xdr.SorobanAuthorizationEntry[] {
  let entries: xdr.SorobanAuthorizationEntry[];
  try {
    entries = xdr.SorobanAuthorizationEntries.fromXDR(base64, "base64");
  } catch {
    fail("MALFORMED_XDR");
  }
  // Chặn payload dị dạng nhiều entry bất thường (spec: 2, +1 nếu client_domain).
  if (entries.length > 4) fail("TOO_MANY_ENTRIES");
  return entries;
}

// ---------- args map ----------

/** ScMap Symbol→String — key PHẢI sort (host reject map không sort). Export cho infra
 * dựng lại op invokeContractFunction khi simulate. */
export function argsToScVal(args: ChallengeArgs): xdr.ScVal {
  const pairs = Object.entries(args)
    .filter((pair): pair is [string, string] => pair[1] !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return xdr.ScVal.scvMap(
    pairs.map(
      ([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: xdr.ScVal.scvString(v) }),
    ),
  );
}

const ARG_KEYS = new Set([
  "account",
  "home_domain",
  "web_auth_domain",
  "web_auth_domain_account",
  "nonce",
  "client_domain",
  "client_domain_account",
]);

function scValToArgs(value: xdr.ScVal): ChallengeArgs {
  if (value.switch() !== xdr.ScValType.scvMap()) fail("ARGS_NOT_MAP");
  const out: Record<string, string> = {};
  for (const entry of value.map() ?? []) {
    const key = entry.key();
    const val = entry.val();
    if (key.switch() !== xdr.ScValType.scvSymbol()) fail("ARG_KEY_NOT_SYMBOL");
    if (val.switch() !== xdr.ScValType.scvString()) fail("ARG_VAL_NOT_STRING");
    const k = key.sym().toString();
    if (!ARG_KEYS.has(k)) fail("UNKNOWN_ARG");
    out[k] = val.str().toString();
  }
  for (const required of [
    "account",
    "home_domain",
    "web_auth_domain",
    "web_auth_domain_account",
    "nonce",
  ]) {
    if (!out[required]) fail(`MISSING_ARG_${required.toUpperCase()}`);
  }
  return out as ChallengeArgs;
}

// ---------- build challenge ----------

function buildInvocation(
  config: Sep45Config,
  args: ChallengeArgs,
): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(config.webAuthContractId).toScAddress(),
        functionName: WEB_AUTH_FN,
        args: [argsToScVal(args)],
      }),
    ),
    subInvocations: [],
  });
}

function unsignedEntry(
  address: string,
  invocation: xdr.SorobanAuthorizedInvocation,
  validUntilLedger: number,
): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: new xdr.Int64(
          BigInt.asIntN(64, crypto.getRandomValues(new BigUint64Array(1))[0] ?? 0n),
        ),
        signatureExpirationLedger: validUntilLedger,
        // scvVoid = placeholder chuẩn "chưa ký" (khớp simulation RPC). KHÔNG dùng
        // scvVec([]): kit FE đọc placeholder qua readAuthPayload — scvVoid được
        // hiểu là payload rỗng, scvVec bị coi là AuthPayload hỏng và throw.
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  });
}

/**
 * Dựng challenge: entry server (ĐÃ ký bằng signingKey) + entry client (chưa ký).
 * validUntilLedger: ledger hiện tại + TTL/5s (caller lấy từ RPC).
 */
export async function buildChallengeEntries(
  config: Sep45Config,
  signingKey: Keypair,
  args: ChallengeArgs,
  validUntilLedger: number,
): Promise<string> {
  const invocation = buildInvocation(config, args);
  const serverEntry = await authorizeEntry(
    unsignedEntry(config.serverAccount, invocation, validUntilLedger),
    signingKey,
    validUntilLedger,
    config.networkPassphrase,
  );
  const clientEntry = unsignedEntry(args.account, invocation, validUntilLedger);
  return encodeEntriesXdr([serverEntry, clientEntry]);
}

// ---------- validate signed challenge (POST /token, TRƯỚC simulate) ----------

function entryAddress(entry: xdr.SorobanAuthorizationEntry): string {
  const kind = entry.credentials().switch();
  // SEP-45 loại credential DELEGATED (CAP-71 `addressWithDelegates`, và biến thể
  // `addressV2`): người ký thật khi đó không phải địa chỉ ghi trong entry, nên mọi
  // so-địa-chỉ phía dưới không còn nghĩa gì. Tách mã lỗi riêng để log nói đúng
  // chuyện gì xảy ra thay vì gộp vào "không phải address".
  if (
    kind === xdr.SorobanCredentialsType.sorobanCredentialsAddressV2() ||
    kind === xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates()
  ) {
    fail("DELEGATED_CREDENTIALS_FORBIDDEN");
  }
  if (kind !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    fail("CREDENTIALS_NOT_ADDRESS");
  }
  return Address.fromScAddress(entry.credentials().address().address()).toString();
}

// ---------- footprint (SEP-45 §"server verification", closeout §4) ----------

/**
 * Cổng CƠ CHẾ chống biến /challenge thành máy ký thuê.
 *
 * Các check cấu trúc ở `validateSignedEntries` chặn theo DANH SÁCH: sai contract,
 * sai hàm, có subInvocation, args lệch… Chúng đúng, nhưng đều là "ta có nghĩ ra
 * đường đó không". Footprint thì ngược lại: nó là thứ Soroban BÁO CÁO là giao dịch
 * sẽ GHI vào đâu. Một entry `transfer` lén vào bằng bất kỳ đường nào ta chưa nghĩ
 * ra vẫn phải ghi vào balance, và balance thì hiện ra ở `read_write` — nên nó bị
 * chặn mà không cần ta đoán trước hình dạng của đòn tấn công.
 *
 * Spec cho phép ĐÚNG một loại entry trong `read_write`: `contract_data` với key là
 * `ledger_key_nonce`, thuộc Client Account · Server Account · (tuỳ chọn) Client
 * Domain Account. Bất kỳ thứ gì khác → từ chối.
 *
 * `read_only` KHÔNG kiểm: đọc không đổi trạng thái, và simulate luôn cần đọc
 * instance/wasm của chính contract web-auth.
 */
export function assertNonceOnlyFootprint(
  readWrite: readonly xdr.LedgerKey[],
  allowedAddresses: readonly string[],
): void {
  const allowed = new Set(allowedAddresses);
  for (const key of readWrite) {
    if (key.switch() !== xdr.LedgerEntryType.contractData()) fail("FOOTPRINT_NOT_CONTRACT_DATA");
    const data = key.contractData();
    if (data.key().switch() !== xdr.ScValType.scvLedgerKeyNonce()) {
      // Đây là dòng bắt `transfer`: ghi balance là contract_data key kiểu map/vec,
      // không phải nonce.
      fail("FOOTPRINT_NOT_NONCE");
    }
    let owner: string;
    try {
      owner = Address.fromScAddress(data.contract()).toString();
    } catch {
      fail("FOOTPRINT_BAD_ADDRESS");
    }
    if (!allowed.has(owner)) fail("FOOTPRINT_UNEXPECTED_ADDRESS");
  }
}

/** Địa chỉ được phép xuất hiện trong `read_write` — theo spec, đúng 2 (+1 optional). */
export function footprintAllowedAddresses(
  config: Sep45Config,
  args: ChallengeArgs,
): readonly string[] {
  const list = [args.account, config.serverAccount];
  if (args.client_domain_account) list.push(args.client_domain_account);
  return list;
}

/** Mọi check cấu trúc của spec (mục server verification) TRỪ chữ ký — chữ ký do simulate. */
export function validateSignedEntries(
  config: Sep45Config,
  entriesXdrBase64: string,
): ValidatedChallenge {
  const entries = decodeEntriesXdr(entriesXdrBase64);
  if (entries.length < 2) fail("TOO_FEW_ENTRIES");

  let sharedArgs: ChallengeArgs | undefined;
  for (const entry of entries) {
    const invocation = entry.rootInvocation();
    if (invocation.subInvocations().length > 0) fail("SUB_INVOCATIONS_FORBIDDEN");
    const fn = invocation.function();
    if (
      fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()
    ) {
      fail("NOT_CONTRACT_FN");
    }
    const call = fn.contractFn();
    if (Address.fromScAddress(call.contractAddress()).toString() !== config.webAuthContractId) {
      fail("WRONG_CONTRACT");
    }
    if (call.functionName().toString() !== WEB_AUTH_FN) fail("WRONG_FUNCTION");
    if (call.args().length !== 1) fail("WRONG_ARG_COUNT");
    const argsVal = call.args()[0];
    if (!argsVal) fail("WRONG_ARG_COUNT");
    const args = scValToArgs(argsVal);
    if (sharedArgs && JSON.stringify(args) !== JSON.stringify(sharedArgs)) {
      fail("ARGS_MISMATCH_ACROSS_ENTRIES");
    }
    sharedArgs = args;
  }
  const args = sharedArgs as ChallengeArgs;

  if (args.home_domain !== config.homeDomain) fail("HOME_DOMAIN_MISMATCH");
  if (args.web_auth_domain !== config.webAuthDomain) fail("WEB_AUTH_DOMAIN_MISMATCH");
  if (args.web_auth_domain_account !== config.serverAccount) fail("SERVER_ACCOUNT_MISMATCH");
  if (!args.account.startsWith("C")) fail("ACCOUNT_NOT_CONTRACT");
  if (Boolean(args.client_domain) !== Boolean(args.client_domain_account)) {
    fail("CLIENT_DOMAIN_PAIR_MISMATCH");
  }

  const addresses = entries.map(entryAddress);
  if (!addresses.includes(config.serverAccount)) fail("SERVER_ENTRY_MISSING");
  if (!addresses.includes(args.account)) fail("CLIENT_ENTRY_MISSING");

  return { args, account: args.account, nonce: args.nonce };
}
