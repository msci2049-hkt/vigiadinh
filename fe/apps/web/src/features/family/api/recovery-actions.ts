// Luồng GHI recovery (PHA 6 cụm GHI) — gọi 4 route build PHA 5.2 (registry v2):
// build (BE simulate, trả entries) → [ký ở tầng wallet] → submit (BE validate
// whitelist, ví phí ký ENVELOPE trả phí — không giữ quyền). Module này THUẦN
// HTTP — việc ký passkey nằm ở features/wallet (cấm import chéo feature).
import { apiClient } from "@/lib/api-client";

export type RecoveryActionName = "register" | "initiate" | "approve" | "veto" | "addGuardian";

export type BuiltRecoveryAction = {
  action: RecoveryActionName;
  wallet_id: string;
  transaction_xdr: string;
  auth_entries_xdr: string[];
  latest_ledger: number;
};

export type SubmittedRecoveryAction = {
  method: string;
  hash: string;
  status: string;
};

/** Khoá mới cho initiate — vật liệu signer THẬT (guardian phê duyệt đúng nó). */
export type NewSignerMaterial = {
  verifier: string;
  keyBase64: string;
};

export async function buildRecoveryAction(input: {
  action: RecoveryActionName;
  walletId: string;
  newSigner?: NewSignerMaterial;
  /** Chỉ addGuardian: địa chỉ hợp đồng của người bảo hộ (wizard mức B). */
  guardianAddress?: string;
}): Promise<BuiltRecoveryAction> {
  const res = await apiClient.post<{ data: BuiltRecoveryAction }>(`/api/recovery/${input.action}`, {
    wallet_id: input.walletId,
    ...(input.newSigner
      ? {
          new_signer_verifier: input.newSigner.verifier,
          new_signer_key: input.newSigner.keyBase64,
        }
      : {}),
    ...(input.guardianAddress ? { guardian_address: input.guardianAddress } : {}),
  });
  return res.data;
}

export async function submitRecoveryAction(input: {
  walletId: string;
  signedEntriesXdr: string[];
}): Promise<SubmittedRecoveryAction> {
  const res = await apiClient.post<{ data: SubmittedRecoveryAction }>("/api/recovery/submit", {
    wallet_id: input.walletId,
    signed_entries: input.signedEntriesXdr,
  });
  return res.data;
}

export async function finalizeRecovery(input: {
  walletId: string;
}): Promise<SubmittedRecoveryAction> {
  const res = await apiClient.post<{ data: SubmittedRecoveryAction }>("/api/recovery/finalize", {
    wallet_id: input.walletId,
  });
  return res.data;
}
