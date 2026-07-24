// API thừa kế (PHA 6.2) — GET /api/inheritance/wallet/:walletId (heirs, bps
// 0..10000) + POST /api/inheritance/heartbeat ("tôi vẫn ổn" — reset thang nhắc).
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type Heir = {
  id: string;
  walletId: string;
  heirRef: string;
  bps: number;
  createdAt: string;
};

// Tham số chu trình thừa kế (GET /wallet/:id/plan) — im lặng bao lâu thì guardian
// ĐƯỢC GỢI Ý mở claim, timelock cuối (cửa sổ veto owner), bậc leo thang hiện tại.
// null = ví chưa có kế hoạch. Mở claim là hành động on-chain của guardian.
export type InheritancePlan = {
  id: string;
  version: number;
  inactivityPeriodSecs: number;
  finalTimelockSecs: number;
  status: "draft" | "active" | "revoked";
  escalationTier: number;
  updatedAt: string;
};

export const heirKeys = {
  all: ["family", "heirs"] as const,
  byWallet: (walletId: string) => [...heirKeys.all, walletId] as const,
};

export const planKeys = {
  all: ["family", "inheritance-plan"] as const,
  byWallet: (walletId: string) => [...planKeys.all, walletId] as const,
};

export const planOptions = (walletId: string) =>
  queryOptions({
    queryKey: planKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: InheritancePlan | null }>(
        `/api/inheritance/wallet/${walletId}/plan`,
      );
      return res.data;
    },
  });

export const heirsOptions = (walletId: string) =>
  queryOptions({
    queryKey: heirKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Heir[] }>(`/api/inheritance/wallet/${walletId}`);
      return res.data;
    },
  });

export async function sendHeartbeat(walletId: string): Promise<void> {
  await apiClient.post<{ data: { ok: boolean } }>("/api/inheritance/heartbeat", {
    wallet_id: walletId,
  });
}
