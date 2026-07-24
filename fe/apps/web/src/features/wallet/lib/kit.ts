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

/** Reset cho test — không dùng trong app code. */
export function resetWalletKitForTest(): void {
  kit = null;
}
