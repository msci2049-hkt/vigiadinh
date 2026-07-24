// Chống-ký-mù cho guardian (ghi chú audit P0 trong BUILD-LOG): TRƯỚC khi ký
// approve, đối chiếu KHOÁ MỚI nằm trong entry initiate ĐÃ GHI TRÊN CHAIN
// (mirror indexer lưu fingerprint) với những gì màn hình đang hiện. Backend bị
// chiếm mà tráo khoá trong mirror/entry thì hai phía lệch nhau → dừng.
//
// Fingerprint = sha256(ScVal XDR của Signer) — ĐÚNG công thức contract
// (`signer_fingerprint` trong recovery-registry: sha256(signer.to_xdr(e))).
import { xdr } from "@stellar/stellar-sdk";

/** Hex sha256 của một ScVal (dùng WebCrypto — browser + jsdom đều có). */
export async function scValSha256Hex(value: xdr.ScVal): Promise<string> {
  const bytes = new Uint8Array(value.toXDR());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fingerprint của Signer trong entry `initiate_recovery` (arg thứ 2).
 * Trả null nếu entry không phải initiate (không có arg Signer).
 */
export async function initiateSignerFingerprint(entryB64: string): Promise<string | null> {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryB64, "base64");
  const fn = entry.rootInvocation().function();
  if (fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()) {
    return null;
  }
  const call = fn.contractFn();
  if (call.functionName().toString() !== "initiate_recovery") return null;
  const signer = call.args()[1];
  if (!signer) return null;
  return scValSha256Hex(signer);
}

/** Mirror lưu 56 ký tự đầu (cột varchar 56) — so theo prefix, không so cả chuỗi. */
export function fingerprintMatchesMirror(fullHex: string, mirrorPrefix: string): boolean {
  return mirrorPrefix.length >= 16 && fullHex.startsWith(mirrorPrefix);
}
