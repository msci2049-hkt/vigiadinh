// WHY: Pin THỦ CÔNG thuật toán hash mật khẩu = node:crypto.scrypt (async →
// offload libuv threadpool, KHÔNG block event loop trên Bun). Đã verify Bun
// resolve "node" export condition của Better Auth ra đúng impl này, nhưng pin
// explicit vì:
//   1. Format BA lưu (`salt:key`) KHÔNG nhúng params → nếu BA bump version đổi
//      params (N/r/p/dkLen), hash cũ verify SAI. Pin = mọi hash chung 1 params.
//   2. Xoá rủi ro bundler (`bun build`) chọn nhầm biến thể `@noble/hashes`
//      (pure-JS, BLOCK event loop) thay vì node:crypto.
//
// Params + format GIỐNG HỆT Better Auth 1.6.x default (đã verify byte-identical:
// scrypt là KDF tất định theo RFC 7914) → mật khẩu user CŨ vẫn verify, KHÔNG
// reset. Trần CPU (semaphore) do `hash-guard` middleware lo — KHÔNG đặt ở đây
// để tránh double-acquire deadlock với middleware.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Better Auth @better-auth/utils/password params (password.node.mjs). maxmem để
// 2× nhu cầu thực (128·N·r) làm headroom — y hệt upstream.
const N = 16384;
const R = 16;
const P = 1;
const DK_LEN = 64;
const MAX_MEM = 128 * N * R * 2;
const SALT_BYTES = 16;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // normalize NFKC: cùng mật khẩu (khác Unicode form) → cùng key. Khớp upstream.
    scrypt(
      password.normalize("NFKC"),
      salt,
      DK_LEN,
      { N, r: R, p: P, maxmem: MAX_MEM },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

/** Hash mật khẩu → `"<saltHex16B>:<keyHex64B>"` (format Better Auth). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const key = await deriveKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

/**
 * Verify mật khẩu với hash đã lưu. So sánh constant-time (`timingSafeEqual`) —
 * an toàn hơn `===` của upstream (rule #10), kết quả accept/reject giống hệt nên
 * vẫn backward-compat. Hash hỏng/format lạ → false (không leak, không throw 500).
 */
export async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  const parts = data.hash.split(":");
  const salt = parts[0];
  const keyHex = parts[1];
  if (!salt || !keyHex || parts.length !== 2) return false;
  const stored = Buffer.from(keyHex, "hex");
  if (stored.length !== DK_LEN) return false; // hex hỏng/độ dài sai
  const target = await deriveKey(data.password, salt);
  return timingSafeEqual(target, stored);
}
