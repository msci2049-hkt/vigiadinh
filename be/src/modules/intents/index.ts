// Public facade — module khác CHỈ import từ đây (luật module-boundary).

export type { IntentAction, IntentActor } from "./domain/state-machine";
export {
  assertTransition,
  INTENT_ACTIONS,
  INTENT_ACTORS,
  nextState,
  TERMINAL_STATES,
} from "./domain/state-machine";
// Audit 2026-07-25 (§8): đọc số dư là NGHIỆP VỤ CHUNG, không riêng luồng gửi tiền.
// Module wallets cần nó cho `GET /api/wallets/:id/balance`; phơi qua facade thay vì
// để wallets deep-import vào features/ của module này (luật module-boundary).
export { readBalance, type SendGateway } from "./features/send-flow/service";
export { intentsRoutes } from "./routes";
