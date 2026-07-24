// Luồng đăng nhập SEP-45: connect passkey → xin challenge → ký entry của ví bằng
// passkey (challenge = P27 auth digest, K2 — kit lo) → đổi JWT → lưu Bearer.
// Mọi HTTP qua apiClient (luật data-fetching); mọi lỗi ném ra cho UI xử lý.
import { apiClient } from "@/lib/api-client";
import { getDeviceId } from "../lib/device-id";
import { getWalletKit } from "../lib/kit";
import {
  decodeEntriesXdr,
  encodeEntriesXdr,
  entryExpirationLedger,
  findEntryIndexForAccount,
} from "../lib/sep45-entries";
import { DEFAULT_CONTEXT_RULE_IDS } from "../lib/sign-wallet-entries";
import { saveWalletToken } from "../lib/wallet-token";

type ChallengeResponse = { authorization_entries: string; network_passphrase: string };
type TokenResponse = { token: string };

export class Sep45LoginError extends Error {}

/**
 * Đăng nhập bằng ví đã kết nối (kit đang giữ contractId + credentialId), hoặc
 * truyền override ngay sau createWallet (kit chưa chắc đã set connected state).
 * Tách khỏi bước connect để màn hình gọi lại được khi JWT hết hạn mà ví vẫn kết nối.
 */
export async function sep45Login(override?: {
  contractId: string;
  credentialId: string;
}): Promise<{ contractId: string }> {
  const kit = getWalletKit();
  const contractId = override?.contractId ?? kit.contractId;
  const credentialId = override?.credentialId ?? kit.credentialId;
  if (!contractId || !credentialId) throw new Sep45LoginError("WALLET_NOT_CONNECTED");

  const query = new URLSearchParams({ account: contractId, device_id: getDeviceId() });
  const challenge = await apiClient.get<ChallengeResponse>(
    `/api/sep45/challenge?${query.toString()}`,
  );

  const entries = decodeEntriesXdr(challenge.authorization_entries);
  const index = findEntryIndexForAccount(entries, contractId);
  const entry = entries[index];
  if (index < 0 || !entry) throw new Sep45LoginError("CHALLENGE_MISSING_WALLET_ENTRY");

  // contextRuleIds tường minh: placeholder BE là scvVoid nên kit không tự đọc
  // được rule ids từ entry (cùng lý do với sign-wallet-entries).
  entries[index] = await kit.signAuthEntry(entry, {
    credentialId,
    expiration: entryExpirationLedger(entry),
    contextRuleIds: DEFAULT_CONTEXT_RULE_IDS,
  });

  const { token } = await apiClient.post<TokenResponse>("/api/sep45/token", {
    authorization_entries: encodeEntriesXdr(entries),
  });
  saveWalletToken(token);
  return { contractId };
}

/** Connect ví (prompt passkey nếu chưa có session kit) rồi đăng nhập SEP-45. */
export async function connectAndLogin(): Promise<{ contractId: string }> {
  const kit = getWalletKit();
  if (!kit.isConnected) {
    const result = await kit.connectWallet({ prompt: true });
    if (!result) throw new Sep45LoginError("WALLET_CONNECT_CANCELLED");
  }
  return sep45Login();
}
