// API người bảo hộ (PHA 6.2) — GET /api/guardians/wallet/:walletId.
// status khớp CHECK constraint BE (guardians.schema): 5 giá trị.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type GuardianStatus = "invited" | "active" | "slow" | "offline" | "removed";

export type Guardian = {
  id: string;
  walletId: string;
  userId: string | null;
  onchainKey: string | null;
  status: GuardianStatus;
  lastSeenAt: string | null;
  lastManualConfirmAt: string | null;
  createdAt: string;
  /** Tên gợi nhớ chủ ví đặt ("Mẹ", "Anh Hai") — BE join từ guardian_invites;
   * null với dữ liệu cũ → màn rơi về chuỗi i18n, không để trống. */
  label: string | null;
};

export const guardianKeys = {
  all: ["family", "guardians"] as const,
  byWallet: (walletId: string) => [...guardianKeys.all, walletId] as const,
};

export const guardiansOptions = (walletId: string) =>
  queryOptions({
    queryKey: guardianKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Guardian[] }>(`/api/guardians/wallet/${walletId}`);
      return res.data;
    },
    // LÔ 3: lưới đỡ khi SSE hỏng — quay lại tab là tự cập nhật.
    refetchOnWindowFocus: true,
  });
