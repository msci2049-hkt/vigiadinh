// Link explorer theo MẠNG đang cấu hình (luật stellar: cấm hardcode network).
// Passphrase → segment stellar.expert; passphrase lạ → testnet (an toàn dev).
import { env } from "@/lib/env";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function explorerTxUrl(hash: string): string {
  const net = env.VITE_STELLAR_NETWORK_PASSPHRASE === MAINNET_PASSPHRASE ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}
