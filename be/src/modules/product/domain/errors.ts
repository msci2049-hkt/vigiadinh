// WHY: Domain error code (string). Throw `new Error(PRODUCT_ERRORS.NOT_FOUND)` —
// global onError map `*_NOT_FOUND` → 404 tự động (xem middlewares/error.ts).
export const PRODUCT_ERRORS = {
  NOT_FOUND: "PRODUCT_NOT_FOUND",
  CREATE_FAILED: "PRODUCT_CREATE_FAILED",
} as const;
