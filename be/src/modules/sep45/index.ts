// Public facade — module khác CHỈ import từ đây (luật module-boundary).

// Lookup THẬT của `jwt_version` — middleware dùng chung cần nó để kiểm thu hồi.
// walletIdentityByAddress: cửa đổi JWT ví → session app cần biết ví của user nào.
export { walletIdentityByAddress, walletJwtVersion } from "./infra";
// CHỈ export bản có kiểm thu hồi (closeout §4). Bản chỉ-kiểm-chữ-ký KHÔNG lộ ra
// khỏi module: để nó ở facade là mời người nối dây sau chọn đúng cái thiếu kiểm.
export {
  resolveWalletSession,
  verifyWalletJwtCurrent,
  type WalletSessionState,
  type WalletVersionLookup,
} from "./jwt";
export { sep45Routes } from "./routes";
export type { WalletJwtClaims } from "./types";
