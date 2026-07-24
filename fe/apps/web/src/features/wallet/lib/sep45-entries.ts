// Helper XDR thuần cho challenge SEP-45 phía client — decode vector entries,
// tìm entry của ví mình, thay entry đã ký, encode lại. Đối xứng với
// be/src/modules/sep45/entries.ts (cùng khung VarArray XDR — cùng ghi chú bug
// js-xdr 4.0.0: instance toXDR không nhận value, encode tay).
import { Address, xdr } from "@stellar/stellar-sdk";

export function decodeEntriesXdr(base64: string): xdr.SorobanAuthorizationEntry[] {
  return xdr.SorobanAuthorizationEntries.fromXDR(base64, "base64");
}

// Code chạy trong BROWSER — không có Buffer global (Node), dùng Uint8Array + btoa.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function encodeEntriesXdr(entries: xdr.SorobanAuthorizationEntry[]): string {
  const parts = entries.map((entry) => new Uint8Array(entry.toXDR()));
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 4));
  new DataView(out.buffer).setUint32(0, entries.length, false);
  let offset = 4;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return bytesToBase64(out);
}

/** Vị trí entry mà credentials.address = ví mình (entry server đã ký sẵn thì bỏ qua). */
export function findEntryIndexForAccount(
  entries: xdr.SorobanAuthorizationEntry[],
  account: string,
): number {
  return entries.findIndex((entry) => {
    if (entry.credentials().switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
      return false;
    }
    return Address.fromScAddress(entry.credentials().address().address()).toString() === account;
  });
}

/** signatureExpirationLedger BE đã đặt trong entry — truyền lại cho kit để chữ ký
 * không bị kit ghi đè expiration khác (digest P27 bao gồm expiration). */
export function entryExpirationLedger(entry: xdr.SorobanAuthorizationEntry): number {
  return entry.credentials().address().signatureExpirationLedger();
}
