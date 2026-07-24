// API sổ hoạt động (PHA 6.2) — GET /api/audit/wallet/:walletId (audit_log
// append-only: event on-chain mirror + hành động hệ thống/người).
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type AuditEntry = {
  id: string;
  walletId: string;
  kind: string;
  payload: unknown;
  actorType: "owner" | "guardian" | "system" | "ai" | null;
  actorId: string | null;
  deviceId: string | null;
  at: string;
};

export const auditKeys = {
  all: ["family", "audit"] as const,
  byWallet: (walletId: string) => [...auditKeys.all, walletId] as const,
};

export const auditOptions = (walletId: string) =>
  queryOptions({
    queryKey: auditKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: AuditEntry[] }>(`/api/audit/wallet/${walletId}`);
      return res.data;
    },
  });
