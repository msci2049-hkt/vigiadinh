// Luồng GỬI TIỀN (PHA 6 SEND) — thuần HTTP, đi qua pipeline intent BE. Việc ký
// passkey nằm ở features/wallet (cấm import chéo feature). amount = chuỗi stroops
// (ScaledAmount 7 số lẻ của module tiền PHA 7.1 CHÍNH LÀ stroops).
import { apiClient } from "@/lib/api-client";

export type SendReview = {
  intentId: string;
  status: string;
  from: string;
  recipient: string;
  amount: string;
  balance: string;
};

export type ConfirmResult =
  | {
      intentId: string;
      status: "awaiting_signature";
      transactionXdr: string;
      authEntriesXdr: string[];
      latestLedger: number;
    }
  | { intentId: string; status: "awaiting_guardian"; reasons: string[] };

export type SettleResult = { intentId: string; status: string; hash: string };

export async function prepareSend(input: {
  walletId: string;
  clientIntentId: string;
  recipient: string;
  amountStroops: string;
}): Promise<SendReview> {
  const res = await apiClient.post<{ data: SendReview }>("/api/intents/send/prepare", {
    wallet_id: input.walletId,
    client_intent_id: input.clientIntentId,
    recipient: input.recipient,
    amount: input.amountStroops,
  });
  return res.data;
}

export async function confirmSend(intentId: string): Promise<ConfirmResult> {
  const res = await apiClient.post<{ data: ConfirmResult }>("/api/intents/send/confirm", {
    intent_id: intentId,
  });
  return res.data;
}

/** Đường guardian: sau khi đủ duyệt, owner poll lấy tx để ký. */
export async function getSignable(intentId: string): Promise<{
  intentId: string;
  transactionXdr: string;
  authEntriesXdr: string[];
  latestLedger: number;
}> {
  const res = await apiClient.get<{
    data: {
      intentId: string;
      transactionXdr: string;
      authEntriesXdr: string[];
      latestLedger: number;
    };
  }>(`/api/intents/send/${intentId}/signable`);
  return res.data;
}

/** Chủ ví RÚT LẠI lệnh khi tiền chưa đi (LÔ 1 A6) — hợp lệ tới trước submitting. */
export async function cancelSend(intentId: string): Promise<{ intentId: string; status: string }> {
  const res = await apiClient.post<{ data: { intentId: string; status: string } }>(
    `/api/intents/${intentId}/cancel`,
    {},
  );
  return res.data;
}

export async function signSend(input: {
  intentId: string;
  signedEntriesXdr: string[];
}): Promise<SettleResult> {
  const res = await apiClient.post<{ data: SettleResult }>("/api/intents/send/sign", {
    intent_id: input.intentId,
    signed_entries: input.signedEntriesXdr,
  });
  return res.data;
}
