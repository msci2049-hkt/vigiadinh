// API ngưỡng chi tiêu (lô policy 2026-07-29) — hai tầng:
// - Ngưỡng MỀM tự cài: GET/PUT /api/wallets/:id/policy + DELETE .../policy/pending
//   (nâng chờ 24h, hạ áp ngay — BE là nơi cưỡng chế, đây chỉ là dây HTTP).
// - Trần CỨNG on-chain: GET /api/wallets/:id/onchain-policy (đọc thẳng chain) +
//   prepare/submit `add_policy` cho VÍ CŨ (D3 — ví mới gắn sẵn từ constructor).
// Số tiền đi dây dạng CHUỖI STROOPS (khuôn send). queryKey prefix ["family"] để
// SSE domain events invalidate một nhát trúng luôn màn Cài đặt.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type PolicyView = {
  perTxLimit: string;
  dailyLimit: string;
  version: number;
  effectiveAt: string;
};

export type SpendingPolicy = {
  active: PolicyView;
  pending: PolicyView | null;
  onchainCapStroops: string;
};

export type PutPolicyResult = {
  kind: "applied" | "pending" | "unchanged";
  active: PolicyView;
  pending: PolicyView | null;
};

export type OnchainPolicyStatus = {
  /** true: rule 0 đã chở policy · false: chưa · null: chain không trả lời được. */
  attached: boolean | null;
  policyContractId: string;
};

export const policyKeys = {
  soft: (walletId: string) => ["family", "policy", walletId] as const,
  onchain: (walletId: string) => ["family", "policy", walletId, "onchain"] as const,
};

export const spendingPolicyOptions = (walletId: string) =>
  queryOptions({
    queryKey: policyKeys.soft(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: SpendingPolicy }>(`/api/wallets/${walletId}/policy`);
      return res.data;
    },
    refetchOnWindowFocus: true, // lưới đỡ khi SSE rớt — banner đếm ngược không nói dối
  });

export const onchainPolicyOptions = (walletId: string) =>
  queryOptions({
    queryKey: policyKeys.onchain(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: OnchainPolicyStatus }>(
        `/api/wallets/${walletId}/onchain-policy`,
      );
      return res.data;
    },
    staleTime: 60_000, // đọc chain qua BE — không cần dồn dập
  });

export async function putSpendingPolicy(input: {
  walletId: string;
  perTxStroops: string;
  dailyStroops: string;
}): Promise<PutPolicyResult> {
  const res = await apiClient.put<{ data: PutPolicyResult }>(
    `/api/wallets/${input.walletId}/policy`,
    { per_tx_limit: input.perTxStroops, daily_limit: input.dailyStroops },
  );
  return res.data;
}

export async function cancelPendingPolicy(walletId: string): Promise<void> {
  await apiClient.delete(`/api/wallets/${walletId}/policy/pending`);
}

export type BuiltAddPolicy = {
  transactionXdr: string;
  authEntriesXdr: string[];
  latestLedger: number;
};

export async function prepareEnableOnchainPolicy(walletId: string): Promise<BuiltAddPolicy> {
  const res = await apiClient.post<{ data: BuiltAddPolicy }>(
    `/api/wallets/${walletId}/onchain-policy/prepare`,
    {},
  );
  return res.data;
}

export async function submitEnableOnchainPolicy(input: {
  walletId: string;
  signedEntriesXdr: string[];
}): Promise<{ hash: string; status: string; attached: boolean }> {
  const res = await apiClient.post<{ data: { hash: string; status: string; attached: boolean } }>(
    `/api/wallets/${input.walletId}/onchain-policy/submit`,
    { signed_entries: input.signedEntriesXdr },
  );
  return res.data;
}
