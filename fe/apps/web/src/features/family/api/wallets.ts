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
  balance: (walletId: string) => [...walletKeys.all, walletId, "balance"] as const,
};

export const walletsOptions = queryOptions({
  queryKey: walletKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: FamilyWallet[] }>("/api/wallets");
    return res.data;
  },
});

export type WalletBalance = {
  wallet_id: string;
  address: string;
  /** Stroops dạng CHUỖI (i128 on-chain — qua Number là mất chữ số câm lặng). */
  balance: string;
  asset: string;
};

/**
 * GET /api/wallets/:id/balance — đường ĐỌC thuần (BE tách khỏi pipeline send,
 * audit 2026-07-25 §8). BE trả Cache-Control: no-store; staleTime 30s ở đây chỉ
 * chống refetch dồn dập khi điều hướng qua lại, không phải cache tiền lâu.
 */
export const walletBalanceOptions = (walletId: string) =>
  queryOptions({
    queryKey: walletKeys.balance(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: WalletBalance }>(`/api/wallets/${walletId}/balance`);
      return res.data;
    },
    staleTime: 30_000,
  });

/**
 * Lựa chọn thời gian chờ — khớp `TIMELOCK_CHOICES_SECS` của BE, và qua đó khớp
 * sàn `MIN_TIMELOCK_SECS` (86_400) mà registry cưỡng chế on-chain. Thêm giá trị
 * thấp hơn ở đây = mời người dùng vào một wizard chắc chắn panic ở bước cuối.
 */
export const TIMELOCK_CHOICES_SECS = [86400, 259200, 604800] as const;

/**
 * Số giây → key i18n. Trả literal (không ghép chuỗi runtime) vì key i18n của
 * repo có kiểu chặt: union hữu hạn, template literal không qua được tsc.
 */
export const TIMELOCK_LABEL_KEY = {
  86400: "setup.timelock.choice.day1",
  259200: "setup.timelock.choice.day3",
  604800: "setup.timelock.choice.day7",
} as const;

export type TimelockLabelKey = (typeof TIMELOCK_LABEL_KEY)[keyof typeof TIMELOCK_LABEL_KEY];

/** Giá trị lạ (ví cấu hình ngoài app) → rơi về nhãn 1 ngày thay vì hiện key thô. */
export function timelockLabelKey(secs: number): TimelockLabelKey {
  return TIMELOCK_LABEL_KEY[secs as keyof typeof TIMELOCK_LABEL_KEY] ?? TIMELOCK_LABEL_KEY[86400];
}

/**
 * Sửa ngưỡng + thời gian chờ. CHỈ được trước khi ví đăng ký lên registry —
 * sau đó chain đóng băng hai giá trị này và BE trả 409 ALREADY_REGISTERED_ONCHAIN.
 */
export async function updateRecoveryConfig(input: {
  walletId: string;
  threshold?: number;
  timelockSecs?: number;
}): Promise<FamilyWallet> {
  const res = await apiClient.patch<{ data: FamilyWallet }>(
    `/api/wallets/${input.walletId}/recovery-config`,
    {
      ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
      ...(input.timelockSecs !== undefined ? { timelock_secs: input.timelockSecs } : {}),
    },
  );
  return res.data;
}
