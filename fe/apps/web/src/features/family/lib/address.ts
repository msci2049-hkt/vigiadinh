// Phân loại địa chỉ dán/quét vào ô "Gửi tới" (LÔ 4, 2026-07-29).
//
// Validate bằng StrKey của SDK (có CHECKSUM) — regex [GC]{55} cũ cho qua chuỗi
// gõ sai một ký tự, tiền đi thẳng vào hư không. Ba dạng người thật gặp:
//   C… ví hợp đồng (ví FamilyWallet, ví bạn bè)   → gửi được
//   G… tài khoản classic (ví cá nhân, ví cũ)       → gửi được
//   M… muxed (sàn giao dịch — Kraken…): mã hoá SẴN tài khoản nhận + id khách,
//      THAY THẾ memo. Ví này là contract account, giao dịch đi bằng SAC
//      `transfer` (không phải payment classic) nên KHÔNG có trường memo —
//      vì thế KHÔNG thêm ô memo, nhận diện M… và nói thật trạng thái hỗ trợ.
//      Tầng dưới (BE dto + SAC transfer) hiện CHỈ nhận G/C → M… được nhận
//      diện ĐÚNG nhưng chặn gửi với câu hướng dẫn rõ, cấm im lặng nuốt.
//      Chi tiết + đường mở lại: docs/SEND-ADDRESSES.md.
import { StrKey } from "@stellar/stellar-sdk";

export type AddressKind = "contract" | "classic" | "muxed" | "invalid";

export function classifyAddress(raw: string): AddressKind {
  const value = raw.trim();
  if (StrKey.isValidContract(value)) return "contract";
  if (StrKey.isValidEd25519PublicKey(value)) return "classic";
  if (StrKey.isValidMed25519PublicKey(value)) return "muxed";
  return "invalid";
}

/** Dạng gửi được qua pipeline hiện tại (BE + SAC transfer). */
export function isSendableAddress(raw: string): boolean {
  const kind = classifyAddress(raw);
  return kind === "contract" || kind === "classic";
}

export function shortAddress(raw: string): string {
  const value = raw.trim();
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}
