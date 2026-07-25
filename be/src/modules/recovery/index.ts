// Bộ mã Signer::External (verifier + key) dùng chung: recovery (khoá mới) + send
// e2e (khoá ví). Facade export để module khác import qua @/modules/recovery, không
// deep-import domain (luật module-boundary).
export { externalSignerScVal } from "./domain/onchain";
export type { NewRecoveryRequest, RecoveryRequest, RecoveryStatus } from "./domain/recovery.entity";
// Giải mã view registry — job recovery-watch dùng để đọc THẲNG chain.
export { type ChainRecoveryRequest, parseRecoveryStatus } from "./features/chain-truth/domain";
