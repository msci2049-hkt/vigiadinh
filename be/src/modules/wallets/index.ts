// WHY: Public facade — consumer ngoài module CHỈ import từ "@/modules/wallets".
// Ngưỡng mềm chi tiêu (lô policy): policy engine của intents đọc giá trị THẬT
// của ví qua facade này thay vì deep-import infra (luật module-boundary).
export {
  DEFAULT_DAILY_STROOPS,
  DEFAULT_PER_TX_STROOPS,
  ONCHAIN_CAP_STROOPS,
  ONCHAIN_PERIOD_LEDGERS,
  type PolicyLimits,
} from "./domain/spending-policy";
export type { NewWallet, Wallet } from "./domain/wallet.entity";
export { effectiveLimits } from "./infra/wallet-policies.repository";
