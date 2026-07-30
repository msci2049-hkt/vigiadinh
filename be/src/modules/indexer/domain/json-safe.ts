// Ép giá trị đã decode từ ScVal về dạng ghi được vào jsonb (PHA 4.2 — vá sự cố
// 2026-07-30: indexer chết cứng 48 phút, 96 job failed liên tiếp).
//
// NGUYÊN NHÂN: `scValToNative` map u64/i64/u128/i128 → **BigInt của JS**. Event
// `register` của ví thật có value `[2, 86400n]` (threshold u32, timelock u64).
// BigInt đi thẳng vào `event.data` → payload jsonb → `JSON.stringify` của
// postgres-js THROW "cannot serialize BigInt" → rollback CẢ transaction →
// checkpoint không nhích → poll sau fetch lại đúng event đó → vòng lặp chết
// vĩnh viễn. Một event hợp lệ của một người dùng đủ để đứng cả indexer.
//
// QUYẾT ĐỊNH: BigInt → **string**, KHÔNG phải Number.
//   · Number mất chính xác từ 2^53 (9_007_199_254_740_992). Số on-chain vượt
//     ngưỡng đó là chuyện thường, không phải ngoại lệ: amount stroops (1 XLM =
//     10^7 stroop → 2^53 chỉ ~900 triệu XLM), i128 của SAC, timestamp nano.
//     Sai một chữ số trong một con số TIỀN là hạng lỗi không được phép có.
//   · string giữ nguyên từng chữ số, và trùng đúng quy ước tiền của FE
//     (`ScaledAmount` = chuỗi BigInt đã scale — packages/core/src/money).
//   · Đánh đổi: mất KIỂU (đọc ra không biết "86400" vốn là u64 hay chuỗi).
//     Chấp nhận được vì payload này là NHẬT KÝ để người đọc và để điều tra,
//     không phải nguồn tính toán; nguồn sự thật của số vẫn là chain.
//
// Uint8Array được GIỮ NGUYÊN (không đổi sang hex): `applyRegistryMirror` nhận
// dạng fingerprint của event `initiate` bằng `value[1] instanceof Uint8Array`.
// Đổi ở đây là phá mirror recovery — jsonb serialize Uint8Array thành object
// chỉ số, xấu nhưng KHÔNG throw, nên không phải chỗ hẹp cần vá lần này.

/**
 * Đệ quy qua array + object thường, đổi MỌI BigInt (kể cả nằm sâu) thành string.
 * Giá trị khác trả về nguyên trạng — hàm này chỉ vá đúng một kiểu không
 * serialize được, không "làm sạch" payload nói chung.
 */
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  // TRƯỚC nhánh object: Uint8Array/Buffer là object nhưng phải giữ nguyên thân
  // (duyệt từng byte sẽ biến nó thành object chỉ số, mất instanceof).
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  // Chỉ đi vào object THƯỜNG. Date/Map/Set/class khác giữ nguyên — scValToNative
  // không sinh ra chúng, và đoán bừa cấu trúc lạ nguy hiểm hơn là để yên.
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}
