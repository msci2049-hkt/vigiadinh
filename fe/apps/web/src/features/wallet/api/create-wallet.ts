// Tạo ví mức A (PHA 6 setup): tạo passkey + deploy smart account NGAY trên máy
// này (kit.createWallet — khoá không rời secure enclave), rồi mirror địa chỉ ví
// C… về BE. BE KHÔNG deploy, KHÔNG giữ khoá — custody trên chuỗi (bất biến 1).
// Thêm guardian là bước RIÊNG sau (qua luồng đổi-quyền có timelock).
//
// Ví deploy ra ĐÃ nối registry khôi phục (mục đặt chỗ trong constructor — xem
// lib/recovery-link.ts). Trước bản này registry không bao giờ được cắm bằng
// đường sản phẩm nào, nên mọi ví tạo qua /setup đều không khôi phục được.
import { apiClient } from "@/lib/api-client";
import { env } from "@/lib/env";
import { getWalletKit } from "../lib/kit";
import { spendingLimitConstructorPolicy } from "../lib/policy-link";
import { recoveryConstructorPolicies } from "../lib/recovery-link";

export type CreatedWallet = { id: string; stellarAddress: string };

/**
 * Deploy ví + mirror về BE. autoSubmit để kit chờ contract lên mạng rồi mới trả
 * contractId; timezone lấy từ trình duyệt (cron ping 12:00 chạy theo giờ này).
 */
export async function createWalletMinimal(): Promise<CreatedWallet> {
  const kit = getWalletKit();
  // Ném TRƯỚC khi tạo passkey: người dùng không nên phải chạm sinh trắc học rồi
  // mới biết cấu hình thiếu — và tuyệt đối không được đẻ ra ví không cứu được.
  const policies = recoveryConstructorPolicies();
  // D1 lô policy — trần cứng chi tiêu gắn vào RULE 0 ngay trong tx deploy
  // (cùng chữ ký, không ceremony thứ hai). Thiếu env → bỏ qua, ví vẫn ra đời
  // (D4), Cài đặt sẽ nhắc bật sau qua đường ví-cũ.
  const spendingLimit = spendingLimitConstructorPolicy();
  if (spendingLimit) policies.push(spendingLimit);
  const userName = `${env.VITE_APP_NAME} owner`;
  const result = await kit.createWallet(env.VITE_APP_NAME, userName, {
    autoSubmit: true,
    policies,
  });
  const contractId = result.contractId;
  if (!contractId) throw new Error("WALLET_DEPLOY_NO_ADDRESS");

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const res = await apiClient.post<{ data: { id: string; stellarAddress: string } }>(
    "/api/wallets",
    { stellar_address: contractId, timezone },
  );
  return { id: res.data.id, stellarAddress: res.data.stellarAddress };
}
