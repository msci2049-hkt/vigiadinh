// Public facade — module khác CHỈ import từ đây (luật module-boundary).

export type { IntentAction, IntentActor } from "./domain/state-machine";
export {
  assertTransition,
  INTENT_ACTIONS,
  INTENT_ACTORS,
  nextState,
  TERMINAL_STATES,
} from "./domain/state-machine";
export { intentsRoutes } from "./routes";
