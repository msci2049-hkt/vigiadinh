// API trạng thái khôi phục (PHA 6.2) — GET /api/recovery/wallet/:walletId
// (mirror recovery_requests — indexer đồng bộ từ chain, PHA 5.2).
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type RecoveryStatus = "pending" | "ready" | "executed" | "vetoed" | "expired";

export type RecoveryRequest = {
  id: string;
  walletId: string;
  newOwner: string;
  status: RecoveryStatus;
  riskScore: number | null;
  approvals: number;
  threshold: number | null;
  txHash: string | null;
  vetoUntil: string | null;
  startedAt: string;
  expiresAt: string | null;
};

export const recoveryKeys = {
  all: ["family", "recovery"] as const,
  byWallet: (walletId: string) => [...recoveryKeys.all, walletId] as const,
};

export const recoveryOptions = (walletId: string) =>
  queryOptions({
    queryKey: recoveryKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: RecoveryRequest[] }>(
        `/api/recovery/wallet/${walletId}`,
      );
      return res.data;
    },
  });

// ---- Sự thật TỪ CHAIN (không qua mirror) ----
//
// Màn veto phải đọc chain: chủ ví chỉ chặn được nếu BIẾT có khôi phục đang mở,
// mà "biết" qua mirror nghĩa là indexer chết trong cửa sổ timelock thì không ai
// báo, không ai chặn, khôi phục hoàn tất. Kẻ tấn công không cần phá chữ ký nào.

export type OnchainRecoveryStatus = "pending" | "approved" | "finalized" | "cancelled";

/** Cửa sổ bảo vệ sau khôi phục — ví chối MỌI chữ ký tới khi hết (hành vi ĐÚNG). */
export type ChainCooldown = {
  active: boolean;
  /** Unix giây; null = chưa từng khôi phục. */
  activeUntil: number | null;
  cooldownSecs: number;
};

export type ChainTruth = {
  registered: boolean;
  cooldown: ChainCooldown;
  config: { guardians: string[]; threshold: number; timelockSecs: number } | null;
  request: {
    status: OnchainRecoveryStatus;
    approvals: string[];
    startedAt: number;
    timelockRemainingSecs: number;
  } | null;
};

export const chainTruthKeys = {
  byWallet: (walletId: string) => ["family", "recovery", "chain-truth", walletId] as const,
};

export const chainTruthOptions = (walletId: string) =>
  queryOptions({
    queryKey: chainTruthKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ChainTruth }>(
        `/api/recovery/chain-truth/${walletId}`,
      );
      return res.data;
    },
    // Cửa sổ chặn tính bằng giờ; làm mới thường xuyên hơn mirror vì đây là
    // nguồn quyết định việc người dùng có kịp chặn hay không.
    refetchInterval: 20_000,
    staleTime: 0,
    // Mặc định app tắt refetch-on-focus và interval NGỪNG khi tab ẩn — với màn
    // veto thì tab ẩn 2 giờ quay lại là 20s nhìn dữ liệu 2 giờ tuổi nói "không
    // có gì đang mở". Query này là mắt canh chain: quay lại tab phải hỏi lại
    // NGAY, và còn ẩn vẫn poll (browser có throttle nhưng tốt hơn im hẳn).
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });

/** Yêu cầu đang MỞ theo chain (pending/approved) — thứ duy nhất veto được. */
export function openOnchainRequest(truth: ChainTruth | undefined) {
  const req = truth?.request;
  if (!req) return null;
  return req.status === "pending" || req.status === "approved" ? req : null;
}
