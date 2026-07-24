// Ký auth entries luồng recovery bằng PASSKEY của ví (PHA 6 cụm GHI).
// K2 thoả từ kiến trúc: kit.signAuthEntry derive digest TỪ CHÍNH entry
// (sha256(signature_payload ++ scvVec(rule_ids).toXDR()) — công thức đã chứng
// minh on-chain ở e2e audit P0), không có challenge random = không ký mù.
// Chỉ ký entry mà credentials.address = VÍ ĐANG CONNECT; entry của người khác
// (vd guardian classic) giữ nguyên — người đó tự ký trên máy họ.
import { Address, xdr } from "@stellar/stellar-sdk";
import { getWalletKit } from "./kit";

export class RecoverySignError extends Error {
  constructor(code: "WALLET_NOT_CONNECTED" | "NO_ENTRY_FOR_WALLET") {
    super(code);
    this.name = "RecoverySignError";
  }
}

function entryAddress(entry: xdr.SorobanAuthorizationEntry): string | null {
  if (entry.credentials().switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    return null;
  }
  return Address.fromScAddress(entry.credentials().address().address()).toString();
}

/**
 * Ký các entry thuộc VÍ trong danh sách build trả về (mỗi phần tử MỘT entry
 * base64 — đúng shape route /api/recovery/*). Trả về danh sách cùng thứ tự,
 * entry của ví đã ký, entry khác nguyên vẹn. Expiration neo theo latestLedger
 * của simulation (+120 ledger ≈ 10 phút — dư cho người bấm chậm).
 */
export async function signRecoveryEntries(input: {
  entriesXdr: string[];
  latestLedger: number;
}): Promise<string[]> {
  const kit = getWalletKit();
  const contractId = kit.contractId;
  const credentialId = kit.credentialId;
  if (!contractId || !credentialId) throw new RecoverySignError("WALLET_NOT_CONNECTED");

  const expiration = input.latestLedger + 120;
  let signedAny = false;
  const out: string[] = [];
  for (const b64 of input.entriesXdr) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64");
    if (entryAddress(entry) === contractId) {
      const signed = await kit.signAuthEntry(entry, { credentialId, expiration });
      out.push(signed.toXDR("base64"));
      signedAny = true;
    } else {
      out.push(b64);
    }
  }
  // Không entry nào của ví = build sai luồng (vd veto mà ví chưa connect đúng
  // account) — chặn sớm thay vì submit rồi chết mã khó hiểu ở contract.
  if (!signedAny) throw new RecoverySignError("NO_ENTRY_FOR_WALLET");
  return out;
}
