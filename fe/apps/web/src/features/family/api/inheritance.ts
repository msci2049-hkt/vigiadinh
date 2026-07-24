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

export const heirKeys = {
  all: ["family", "heirs"] as const,
  byWallet: (walletId: string) => [...heirKeys.all, walletId] as const,
};

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
