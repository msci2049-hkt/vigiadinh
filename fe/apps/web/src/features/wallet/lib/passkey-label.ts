// Tên passkey đưa vào kit — MỘT nguồn, có trần BYTE (sự cố 30/07).
//
// Vì sao trần tồn tại: smart-account-kit dựng user.id WebAuthn =
// base64url(`${userName}:${Date.now()}:${Math.random()}`) (webauthn-ops.js:18).
// Spec WebAuthn §5.4.3 giới hạn user handle 1–64 BYTE; đuôi `:epoch:random`
// chiếm tới ~34 byte ⇒ userName chỉ còn 30. Vượt là Chrome chối
// navigator.credentials.create NGAY LẬP TỨC — trước prompt sinh trắc học,
// trước mọi request BE — trên MỌI thiết bị. Đó chính là "Không tạo được ví"
// 30/07: a189e29 đưa email vào userName, email ≥ ~17 byte là tràn.
//
// Đo bằng BYTE UTF-8 (TextEncoder), KHÔNG phải .length: "·" 2 byte, "—" 3 byte,
// "…" 3 byte — đếm ký tự là đúng với TS và sai với trình duyệt (lần thứ 4 của
// lớp bug này).

/** Đuôi kit tự nối: ":" + epoch 13 chữ số + ":" + Math.random() (tối đa "0."+17). */
export const USER_ID_SUFFIX_MAX_BYTES = 34;
/** Trần user handle của spec WebAuthn §5.4.3. */
export const WEBAUTHN_USER_ID_MAX_BYTES = 64;
/** Trần an toàn cho userName đưa vào kit.createWallet / kit.credentials.create. */
export const USER_NAME_MAX_BYTES = WEBAUTHN_USER_ID_MAX_BYTES - USER_ID_SUFFIX_MAX_BYTES;

const encoder = new TextEncoder();

export function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

/** Cắt theo trần BYTE, không bao giờ cắt đôi một ký tự nhiều byte. */
export function truncateToBytes(value: string, maxBytes: number): string {
  if (utf8Bytes(value) <= maxBytes) return value;
  let out = "";
  for (const ch of value) {
    if (utf8Bytes(out + ch) > maxBytes) break;
    out += ch;
  }
  return out;
}

/**
 * Tên passkey của CHỦ VÍ (và của guardian tạo danh tính mới — cùng đường
 * createWalletMinimal). Email nguyên vẹn khi lọt trần (đa số email thật ≤ 30
 * byte — phân biệt được ai là ai trong trình quản lý khoá, đúng mục đích của
 * a189e29); dài hơn thì cắt còn 27 byte + "…" (3 byte). Nhãn app KHÔNG còn
 * trong tên: 30 byte không chứa nổi cả hai, và trình quản lý khoá vốn đã nhóm
 * theo domain của site nên nhãn app là thông tin trùng.
 */
export function passkeyOwnerName(appName: string, ownerLabel?: string | undefined): string {
  const label = ownerLabel?.trim();
  if (!label) return truncateToBytes(`${appName} owner`, USER_NAME_MAX_BYTES);
  if (utf8Bytes(label) <= USER_NAME_MAX_BYTES) return label;
  return `${truncateToBytes(label, USER_NAME_MAX_BYTES - 3)}…`;
}

/**
 * Tên passkey MÁY MỚI gõ cửa khôi phục — có sẵn địa chỉ ví nên tên mang địa
 * chỉ rút gọn (4+4). Bản cũ "FamilyHaven recovery CCMT…M4A4" = 32 byte → user.id
 * 66 byte: chính luồng khôi phục cũng chết vì cùng lỗi tràn.
 */
export function recoveryPasskeyName(appName: string, address: string): string {
  const addr = `${address.slice(0, 4)}…${address.slice(-4)}`;
  const budget = USER_NAME_MAX_BYTES - utf8Bytes(` ${addr}`);
  return `${truncateToBytes(appName, budget)} ${addr}`;
}
