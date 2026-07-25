// Luồng MÁY MỚI của người mất máy (PHA 6 cụm GHI — public, chưa có session):
// 1) tạo passkey MỚI ngay trên máy này (khoá không bao giờ rời secure enclave),
// 2) gửi vật liệu PUBLIC (verifier + public key) qua cửa public cho guardian,
// 3) giữ draft CHỈ trong RAM của phiên SPA để màn "done" nối ví sau khi khôi phục xong.
// Reload/tab mới cố ý mất draft: vật liệu liên kết ví không được persist trong web storage.
// Server chỉ chuyển lời — không sinh/giữ/ký khoá (bất biến 2).
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { env } from "@/lib/env";
import { getWalletKit } from "../lib/kit";

export type RecoveryDraft = {
  address: string;
  credentialId: string;
  /** Public key passkey mới (base64) — cần lại ở màn done để bind credential vào ví. */
  keyBase64: string;
  fingerprint: string;
};

let recoveryDraft: RecoveryDraft | null = null;

export function loadRecoveryDraft(): RecoveryDraft | null {
  return recoveryDraft;
}

export function clearRecoveryDraft(): void {
  recoveryDraft = null;
}

// Browser không có Buffer — encode/decode tay như sep45-entries.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * "Gõ cửa": tạo passkey mới (kit.credentials.create — khoá nằm trong secure
 * enclave máy này) + nộp vật liệu PUBLIC cho guardian của ví. Trả draft kèm
 * fingerprint SERVER tính (trùng công thức contract — có cargo/bun test vector
 * chéo) để chủ ví đọc mã cho người thân qua điện thoại.
 */
export async function knockWithNewPasskey(address: string): Promise<RecoveryDraft> {
  const kit = getWalletKit();
  const label = `${env.VITE_APP_NAME} recovery ${address.slice(0, 4)}…${address.slice(-4)}`;
  const cred = await kit.credentials.create({ nickname: label });
  const keyBase64 = bytesToBase64(cred.publicKey);
  const res = await apiClient.post<{ data: { accepted: boolean; fingerprint: string } }>(
    "/api/recovery/public/device-request",
    {
      wallet_address: address,
      verifier: env.VITE_WEBAUTHN_VERIFIER_ADDRESS,
      key_base64: keyBase64,
    },
  );
  const draft: RecoveryDraft = {
    address,
    credentialId: cred.credentialId,
    keyBase64,
    fingerprint: res.data.fingerprint,
  };
  recoveryDraft = draft;
  return draft;
}

export type PublicProgress = {
  status: string;
  approvals?: number;
  threshold?: number | null;
  vetoUntil?: string | null;
  startedAt?: string;
};

export const publicProgressKeys = {
  byAddress: (address: string) => ["public-recovery", "progress", address] as const,
};

/** Poll tiến độ 30s — dữ liệu vốn public trên chain, không cần session. */
export const publicProgressOptions = (address: string) =>
  queryOptions({
    queryKey: publicProgressKeys.byAddress(address),
    queryFn: async () => {
      const query = new URLSearchParams({ address });
      const res = await apiClient.get<{ data: PublicProgress }>(
        `/api/recovery/public/progress?${query.toString()}`,
      );
      return res.data;
    },
    refetchInterval: 30_000,
    // Người mất máy để tab này mở chờ người thân duyệt — tab ẩn/quay lại phải
    // thấy tiến độ MỚI ngay, không đợi hết tick 30s kế tiếp (mirror WP4 veto).
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });

/**
 * Sau khi khôi phục xong on-chain: bind credential đã tạo lúc gõ cửa vào VÍ CŨ
 * (địa chỉ không đổi) rồi connect kit thẳng vào contract đó. Từ đây passkey
 * mới ký được mọi entry của ví.
 */
export async function connectRecoveredWallet(): Promise<string> {
  const draft = loadRecoveryDraft();
  if (!draft) throw new Error("NO_RECOVERY_DRAFT");
  const kit = getWalletKit();
  await kit.credentials.save({
    credentialId: draft.credentialId,
    publicKey: base64ToBytes(draft.keyBase64),
    contractId: draft.address,
  });
  await kit.connectWallet({ contractId: draft.address, credentialId: draft.credentialId });
  clearRecoveryDraft();
  return draft.address;
}
