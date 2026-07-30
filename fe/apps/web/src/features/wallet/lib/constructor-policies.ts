// Sắp `policies` cho `__constructor` theo THỨ TỰ HOST của Soroban — MỘT chỗ,
// ngay trước cửa kit (sự cố 30/07).
//
// Vì sao bắt buộc: host đòi ScMap sorted by key, nhưng cả chuỗi encode giữ
// NGUYÊN thứ tự chèn của mảng này — kit `buildConstructorPolicies` (JS Map,
// insertion order), bindings, rồi SDK `contract/spec` encode Map cũng theo
// insertion order; không mắt xích nào sort. Map [registry CDGB…, policy CCIN…]
// bị host chối ngay lúc convert input ("ScMap was not sorted by key for
// conversion to host object"): mọi lần tạo ví chết ở simulate, SAU khi passkey
// đã tạo. Kit CÓ sort ở đường `policies.add()` sau deploy — riêng đường
// constructor thì không, nên FE phải tự lo.
//
// Luật so sánh: key của ta toàn địa chỉ CONTRACT (C…) nên thứ tự host = so
// BYTE của contract hash 32 byte. KHÔNG so chuỗi strkey: cùng loại C… thì
// base32 tình cờ bảo toàn thứ tự, nhưng mai kia có key account (G…) là so
// chuỗi cho kết quả sai — host xếp ScAddress theo discriminant (account TRƯỚC
// contract) rồi mới tới payload. `decodeContract` ném với G… nên nếu ngày đó
// tới, comparator này phải mở rộng có chủ đích chứ không âm thầm sai.
import { StrKey } from "@stellar/stellar-sdk";
import type { PolicyConfig } from "smart-account-kit";

function compareContractHash(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/** Bản sao đã sort theo thứ tự host — không đụng mảng gốc. */
export function sortConstructorPolicies(policies: PolicyConfig[]): PolicyConfig[] {
  return [...policies].sort((a, b) =>
    compareContractHash(StrKey.decodeContract(a.address), StrKey.decodeContract(b.address)),
  );
}
