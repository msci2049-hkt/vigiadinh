// Hỗ trợ e2e passkey — polyfill CHỈ TRONG TEST cho shim credentials của
// Playwright 1.61: shim không implement AuthenticatorAttestationResponse
// .getPublicKey() (trả null), trong khi Chrome/Safari THẬT có API này. Thiếu nó
// smart-account-kit rơi vào parser fallback (offset cứng) → key rác → contract
// chối KeyDataInvalid (#3119) — RESEARCH-LOG §PASSKEY-ONCHAIN. Polyfill parse
// COSE ĐÚNG CHUẨN (tìm nhãn x/y CBOR trong vùng COSE key) → SPKI DER, để kit đi
// nhánh chính như trên trình duyệt thật. Đường KÝ (credentials.get + verify
// on-chain) không bị đụng — bằng chứng secp256r1 vẫn nguyên giá trị.
//
// Type cục bộ (structural) thay vì lib DOM: tsconfig.node.json không bật DOM,
// và callback addInitScript chạy TRONG trình duyệt nên chỉ cần đúng hình dạng.
import type { Page } from "@playwright/test";

export async function installGetPublicKeyPolyfill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type AttestationResponseLike = {
      attestationObject?: ArrayBuffer;
      getPublicKey?: () => ArrayBuffer | null;
      getAuthenticatorData?: () => ArrayBuffer;
    };
    type CredentialLike = { response?: AttestationResponseLike } | null;
    type CredentialsLike = { create: (opts?: unknown) => Promise<CredentialLike> };

    const creds = (navigator as unknown as { credentials: CredentialsLike }).credentials;
    const origCreate = creds.create.bind(creds);

    /**
     * Shim trả getAuthenticatorData() = CẢ attestationObject CBOR (bug shim —
     * đúng chuẩn phải là authData trần). Bóc lớp: tìm key "authData" + header
     * bytes CBOR (0x58/0x59) rồi cắt đúng độ dài khai báo.
     */
    function unwrapAuthData(buf: Uint8Array): Uint8Array {
      const marker = [0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61]; // "authData" (text-8)
      for (let i = 0; i + marker.length + 2 < buf.length; i++) {
        if (marker.every((b, j) => buf[i + j] === b)) {
          const p = i + marker.length;
          const major = buf[p] ?? 0;
          if (major === 0x58) return buf.subarray(p + 2, p + 2 + (buf[p + 1] ?? 0));
          if (major === 0x59) {
            const len = ((buf[p + 1] ?? 0) << 8) | (buf[p + 2] ?? 0);
            return buf.subarray(p + 3, p + 3 + len);
          }
        }
      }
      return buf; // không phải attestationObject → coi như đã là authData
    }

    /** authenticatorData → SPKI DER (P-256 uncompressed). */
    function spkiFromAuthData(authData: Uint8Array): ArrayBuffer | null {
      // Layout: rpIdHash(32) + flags(1) + counter(4) + AAGUID(16) + credIdLen(2)
      // + credId(L) + COSE key. Chỉ tìm nhãn x/y TRONG vùng COSE (sau credId).
      if (authData.length < 55 || !((authData[32] ?? 0) & 0x40)) return null;
      const credIdLen = ((authData[53] ?? 0) << 8) | (authData[54] ?? 0);
      const cose = authData.subarray(55 + credIdLen);
      const find = (label: number): Uint8Array | null => {
        // CBOR: nhãn -2/-3 (0x21/0x22) + bytes(32) (0x58 0x20) + 32 byte toạ độ.
        for (let i = 0; i + 35 <= cose.length; i++) {
          if (cose[i] === label && cose[i + 1] === 0x58 && cose[i + 2] === 0x20) {
            return cose.subarray(i + 3, i + 35);
          }
        }
        return null;
      };
      const x = find(0x21);
      const y = find(0x22);
      if (!x || !y) return null;
      const header = [
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
        0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
      ];
      const spki = new Uint8Array(header.length + 65);
      spki.set(header, 0);
      spki[header.length] = 0x04;
      spki.set(x, header.length + 1);
      spki.set(y, header.length + 33);
      return spki.buffer;
    }

    creds.create = async (opts?: unknown) => {
      const cred = await origCreate(opts);
      const resp = cred?.response;
      if (!resp || resp.getPublicKey?.()) return cred; // shim đã có → không đụng
      const raw = resp.getAuthenticatorData?.() ?? resp.attestationObject;
      const spki = raw ? spkiFromAuthData(unwrapAuthData(new Uint8Array(raw))) : null;
      if (!spki) return cred;
      try {
        Object.defineProperty(resp, "getPublicKey", { value: () => spki, configurable: true });
        Object.defineProperty(resp, "getPublicKeyAlgorithm", {
          value: () => -7,
          configurable: true,
        });
      } catch {
        /* response không cho ghi đè — trả nguyên, test sẽ lộ lỗi cũ */
      }
      return cred;
    };
  });
}
