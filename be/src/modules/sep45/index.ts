// Public facade — module khác CHỈ import từ đây (luật module-boundary).

// CHỈ export bản có kiểm thu hồi (closeout §4). Bản chỉ-kiểm-chữ-ký KHÔNG lộ ra
// khỏi module: để nó ở facade là mời người nối dây sau chọn đúng cái thiếu kiểm.
export { verifyWalletJwtCurrent, type WalletVersionLookup } from "./jwt";
export { sep45Routes } from "./routes";
export type { WalletJwtClaims } from "./types";
