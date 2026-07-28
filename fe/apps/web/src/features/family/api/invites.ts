// API lời mời người bảo hộ (wizard mức B — luồng tăng dần).
//
// Điểm khác spec cũ: KHÔNG có bước "gom khoá tất cả rồi deploy một lần". Ví đã
// chạy từ bước 1-2; mỗi người bảo hộ là một chuỗi thao tác MỘT BÊN, độc lập.
// Vì thế wizard hoàn tất được kể cả khi còn người chưa nhận lời — trạng thái
// từng người hiện rõ thay vì treo cả màn.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type InviteStatus = "sent" | "accepted" | "deployed" | "registered" | "expired";

export type GuardianInvite = {
  id: string;
  label: string;
  status: InviteStatus;
  guardian_address: string | null;
  expires_at: string;
};

/** Câu trả lời cho câu hỏi duy nhất người dùng thật sự quan tâm. */
export type Recoverability = {
  available: number;
  threshold: number;
  /** Số người TỐI THIỂU phải lên chain = max(MIN_GUARDIANS=3, threshold). */
  required: number;
  recoverable: boolean;
  missing: number;
};

export const inviteKeys = {
  all: ["family", "invites"] as const,
  byWallet: (walletId: string) => [...inviteKeys.all, walletId] as const,
  byToken: (token: string) => [...inviteKeys.all, "token", token] as const,
};

export const invitesOptions = (walletId: string) =>
  queryOptions({
    queryKey: inviteKeys.byWallet(walletId),
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { invites: GuardianInvite[]; recoverability: Recoverability };
      }>(`/api/guardians/invites/wallet/${walletId}`);
      return res.data;
    },
  });

/** Người được mời mở link — chỉ đọc nhãn, chưa cần đăng nhập. */
export const inviteByTokenOptions = (token: string) =>
  queryOptions({
    queryKey: inviteKeys.byToken(token),
    queryFn: async () => {
      const res = await apiClient.get<{ data: { label: string; status: InviteStatus } }>(
        `/api/guardians/invites/${token}`,
      );
      return res.data;
    },
    retry: false,
  });

export async function createInvite(input: {
  walletId: string;
  label: string;
}): Promise<{ id: string; token: string }> {
  const res = await apiClient.post<{ data: { id: string; token: string } }>(
    "/api/guardians/invites",
    { wallet_id: input.walletId, label: input.label },
  );
  return res.data;
}

/** Nộp ĐỊA CHỈ ví của người bảo hộ. Chỉ public key material rời khỏi máy họ. */
export async function acceptInvite(input: {
  token: string;
  guardianAddress: string;
}): Promise<void> {
  await apiClient.post(`/api/guardians/invites/${input.token}/accept`, {
    guardian_address: input.guardianAddress,
  });
}

/** Chủ ví đã ký `add_guardian` xong → chốt trạng thái cuối. */
export async function markInviteRegistered(inviteId: string): Promise<void> {
  await apiClient.post("/api/guardians/invites/registered", { invite_id: inviteId });
}
