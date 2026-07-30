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
  /**
   * B3 — số tiền + người nhận của lệnh gửi gắn với dòng này, BE join từ
   * `transaction_intents` (payload chỉ chở hash/status/intentId).
   *
   * `amount` là CHUỖI stroops (`ScaledAmount`), không phải số: BigInt không đi qua
   * JSON được, và số tiền không bao giờ được đi qua float. Cả hai NULL với phần lớn
   * dòng (bật bảo vệ, người thân, hạn mức) — dòng đó không dính lệnh gửi nào.
   *
   * Chỉ có tiền RA: mọi dòng join được đều là lệnh gửi CỦA ví này. Tiền VÀO chưa
   * theo dõi được (SAC chưa nằm trong bộ lọc indexer — known issue B4).
   */
  amount: string | null;
  recipient: string | null;
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
