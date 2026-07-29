// Format THUẦN cho thông báo + view phiếu duyệt (LÔ 1 A5) — không I/O.

/** "CDBX…3PBT" — người thân đối chiếu đuôi địa chỉ; không cần chuỗi 56 ký tự,
 * và view guardian CỐ Ý không chở địa chỉ đầy đủ (khuôn protectingItemView). */
export function shortAddress(address: string | null): string {
  if (!address) return "?";
  return address.length <= 12 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** stroops → chuỗi XLM gọn ("10", "0.5") cho thông báo — 7 số lẻ, cắt 0 thừa. */
export function formatXlm(stroops: bigint | null): string {
  if (stroops === null) return "?";
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
