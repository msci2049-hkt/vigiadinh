// Ký auth entries CỦA VÍ bằng PASSKEY — dùng chung recovery + send (cùng cơ chế:
// entry của ví đang connect, ký qua kit.signAuthEntry). K2 thoả từ kiến trúc:
// kit derive digest TỪ CHÍNH entry (sha256(payload ++ scvVec(rule_ids).toXDR())
// — công thức đã chứng minh on-chain), không challenge random = không ký mù.
// Chỉ ký entry mà credentials.address = VÍ ĐANG CONNECT; entry khác giữ nguyên.
import { Address, xdr } from "@stellar/stellar-sdk";
import { ensureWalletConnected } from "./kit";

export class WalletSignError extends Error {
  constructor(code: "WALLET_NOT_CONNECTED" | "NO_ENTRY_FOR_WALLET") {
    super(code);
    this.name = "WalletSignError";
  }
}

// Mức A: ví có MỘT context rule (id 0 — chủ ví), đúng công thức đã chứng minh
// on-chain (BE e2e ký digest với rule_ids [0]). PHẢI truyền tường minh: entry từ
// simulation mang signature placeholder scvVoid nên kit KHÔNG tự đọc được rule
// ids từ entry (readAuthPayload trả rỗng → throw). Mức B (nhiều rule/guardian):
// resolve động theo rule của người ký.
export const DEFAULT_CONTEXT_RULE_IDS = [0];

function entryAddress(entry: xdr.SorobanAuthorizationEntry): string | null {
  if (entry.credentials().switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    return null;
  }
  return Address.fromScAddress(entry.credentials().address().address()).toString();
}

/**
 * Ký các entry thuộc VÍ trong danh sách build trả về (mỗi phần tử MỘT entry
 * base64). Trả về danh sách cùng thứ tự: entry của ví đã ký, entry khác nguyên
 * vẹn. Expiration neo theo latestLedger simulation (+120 ledger ≈ 10 phút).
 */
export async function signWalletEntries(input: {
  entriesXdr: string[];
  latestLedger: number;
}): Promise<string[]> {
  // Nối lại phiên đã lưu trước khi đọc state — sau khi tải lại trang kit rỗng
  // dù IndexedDB còn phiên (xem ensureWalletConnected).
  const kit = await ensureWalletConnected();
  const contractId = kit.contractId;
  const credentialId = kit.credentialId;
  if (!contractId || !credentialId) throw new WalletSignError("WALLET_NOT_CONNECTED");

  const expiration = input.latestLedger + 120;
  let signedAny = false;
  const out: string[] = [];
  for (const b64 of input.entriesXdr) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64");
    if (entryAddress(entry) === contractId) {
      const signed = await kit.signAuthEntry(entry, {
        credentialId,
        expiration,
        contextRuleIds: DEFAULT_CONTEXT_RULE_IDS,
      });
      out.push(signed.toXDR("base64"));
      signedAny = true;
    } else {
      out.push(b64);
    }
  }
  // Không entry nào của ví = build sai luồng — chặn sớm thay vì chết mã khó hiểu.
  if (!signedAny) throw new WalletSignError("NO_ENTRY_FOR_WALLET");
  return out;
}
