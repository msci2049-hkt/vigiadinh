// Tương thích ngược cho luồng recovery — bộ ký entry ví đã tách sang
// sign-wallet-entries.ts (dùng chung với send). Giữ tên cũ để màn recovery +
// test không phải đổi import.
export {
  signWalletEntries as signRecoveryEntries,
  WalletSignError as RecoverySignError,
} from "./sign-wallet-entries";
