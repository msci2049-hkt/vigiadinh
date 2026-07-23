// WHY: Domain error code (string) — onError map `*_NOT_FOUND` → 404.
export const WALLET_ERRORS = {
  NOT_FOUND: "WALLET_NOT_FOUND",
  CREATE_FAILED: "WALLET_CREATE_FAILED",
} as const;
