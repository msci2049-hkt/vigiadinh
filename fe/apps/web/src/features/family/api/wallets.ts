// API ví của hộ (PHA 6.2) — GET /api/wallets. Type khớp row BE serialize
// (drizzle camelCase, timestamp ISO string). Envelope: { data: ... }.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type FamilyWallet = {
  id: string;
  userId: string;
  familyId: string | null;
  timezone: string;
  stellarAddress: string;
  contractId: string | null;
  threshold: number;
  timelockSecs: number;
  createdAt: string;
};

export const walletKeys = {
  all: ["family", "wallets"] as const,
};

export const walletsOptions = queryOptions({
  queryKey: walletKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: FamilyWallet[] }>("/api/wallets");
    return res.data;
  },
});
