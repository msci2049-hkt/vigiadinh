// Tạo ví mức A (PHA 6 setup): tạo passkey + deploy smart account NGAY trên máy
// này (kit.createWallet — khoá không rời secure enclave), rồi mirror địa chỉ ví
// C… về BE. BE KHÔNG deploy, KHÔNG giữ khoá — custody trên chuỗi (bất biến 1).
// Thêm guardian là bước RIÊNG sau (qua luồng đổi-quyền có timelock).
import { apiClient } from "@/lib/api-client";
import { env } from "@/lib/env";
import { getWalletKit } from "../lib/kit";

export type CreatedWallet = { id: string; stellarAddress: string };

/**
 * Deploy ví + mirror về BE. autoSubmit để kit chờ contract lên mạng rồi mới trả
 * contractId; timezone lấy từ trình duyệt (cron ping 12:00 chạy theo giờ này).
 */
export async function createWalletMinimal(): Promise<CreatedWallet> {
  const kit = getWalletKit();
  const userName = `${env.VITE_APP_NAME} owner`;
  const result = await kit.createWallet(env.VITE_APP_NAME, userName, { autoSubmit: true });
  const contractId = result.contractId;
  if (!contractId) throw new Error("WALLET_DEPLOY_NO_ADDRESS");

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const res = await apiClient.post<{ data: { id: string; stellarAddress: string } }>(
    "/api/wallets",
    { stellar_address: contractId, timezone },
  );
  return { id: res.data.id, stellarAddress: res.data.stellarAddress };
}
