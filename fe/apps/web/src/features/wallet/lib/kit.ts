// SmartAccountKit singleton — điểm DUY NHẤT dựng kit từ env (API đối chiếu
// .d.ts bản đã cài 0.4.2, xem RESEARCH-LOG.md root). Lazy: app boot không đụng
// chain; màn ví nào cần mới gọi getWalletKit(), thiếu env thì lỗi RÕ RÀNG.
import { IndexedDBStorage, SmartAccountKit } from "smart-account-kit";
import { env } from "@/lib/env";

let kit: SmartAccountKit | null = null;

/** Thiếu env chain — màn ví hiển thị hướng dẫn cấu hình thay vì trang trắng. */
export class WalletNotConfiguredError extends Error {
  constructor() {
    super("WALLET_NOT_CONFIGURED");
    this.name = "WalletNotConfiguredError";
  }
}

export function getWalletKit(): SmartAccountKit {
  if (kit) return kit;
  if (!env.VITE_ACCOUNT_WASM_HASH || !env.VITE_WEBAUTHN_VERIFIER_ADDRESS) {
    throw new WalletNotConfiguredError();
  }
  kit = new SmartAccountKit({
    rpcUrl: env.VITE_STELLAR_RPC_URL,
    networkPassphrase: env.VITE_STELLAR_NETWORK_PASSPHRASE,
    accountWasmHash: env.VITE_ACCOUNT_WASM_HASH,
    webauthnVerifierAddress: env.VITE_WEBAUTHN_VERIFIER_ADDRESS,
    rpId: env.VITE_PASSKEY_RP_ID,
    rpName: env.VITE_APP_NAME,
    // IndexedDB cho vỏ web; vỏ extension/APK thay adapter (chrome.storage /
    // secure storage) ở PHA 8-9 — kit nhận StorageAdapter qua config.
    storage: new IndexedDBStorage(),
  });
  return kit;
}

let restoring: Promise<unknown> | null = null;

/**
 * Nối lại phiên ví ĐÃ LƯU rồi trả kit — IM LẶNG, không prompt sinh trắc học.
 *
 * Vì sao BẮT BUỘC: `contractId`/`credentialId` của kit là state TRONG BỘ NHỚ,
 * chỉ được đặt bởi `createWallet`/`connectWallet`. Tải lại trang (F5, mở lại
 * app, hay chỉ là điều hướng cứng) dựng kit MỚI với state rỗng, trong khi
 * IndexedDB vẫn giữ phiên do `createWallet` lưu. Không có bước này thì mọi
 * hành động cần chữ ký sau lần tải lại đầu tiên đều chết WALLET_NOT_CONNECTED —
 * người dùng vừa tạo ví xong, quay lại hôm sau là không ký được gì.
 *
 * `connectWallet()` KHÔNG tham số = khôi phục im lặng từ storage (trả null nếu
 * không có phiên) — không có ceremony WebAuthn nào, nên gọi được ở đường ngầm.
 * Một chuyến duy nhất tại một thời điểm: hai màn cùng gọi thì dùng chung.
 */
export async function ensureWalletConnected(): Promise<SmartAccountKit> {
  const k = getWalletKit();
  if (k.contractId && k.credentialId) return k;
  if (!restoring) {
    // Phiên hết hạn / hợp đồng chưa lên chain → kit ném. Nuốt ở đây và để
    // callsite quyết định: chúng đọc contractId rồi báo lỗi theo ngôn ngữ của
    // mình (WALLET_NOT_CONNECTED) thay vì rò lỗi thô của thư viện ra UI.
    restoring = k.connectWallet().catch(() => null);
  }
  try {
    await restoring;
  } finally {
    restoring = null;
  }
  return k;
}

/** Reset cho test — không dùng trong app code. */
export function resetWalletKitForTest(): void {
  kit = null;
  restoring = null;
}
