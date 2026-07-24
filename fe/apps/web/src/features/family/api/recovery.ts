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
