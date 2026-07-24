// Mục ĐẶT CHỖ cắm registry khôi phục vào ví NGAY trong tx deploy.
//
// Vì sao tồn tại file này: `smart-account-kit` khoá cứng constructor đúng hai
// tham số `{signers, policies}` (kit/deploy-ops.js → SmartAccountClient.deploy),
// nên không truyền thêm được địa chỉ registry. Contract của ta nhận nó qua MỘT
// mục đặt chỗ trong chính map `policies` — khoá = địa chỉ registry, giá trị =
// `FwConstructorEntry::RecoveryRegistry(cooldown_secs)`; `__constructor` gỡ mục
// đó ra trước khi đưa phần còn lại cho OZ.
//
// Vì sao KHÔNG cắm bằng tx thứ hai sau deploy: tx đó fail = ví sinh ra VĨNH
// VIỄN không khôi phục được, và không ai biết cho tới đúng lúc cần nó.
//
// Kit không có binding cho contract của ta nên ScVal dựng tay ở đây. Công thức
// được GHIM bằng vector chéo Rust↔TS (recovery-link.test.ts ↔ contracts/
// smart-account/src/test.rs::recovery_entry_xdr_vector_matches_ts) — sửa một
// bên là hai test cùng đỏ.
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { PolicyConfig } from "smart-account-kit";
import { env } from "@/lib/env";

/** Chưa cấu hình registry — deploy tiếp là đẻ ra ví không khôi phục được. */
export class RecoveryRegistryNotConfiguredError extends Error {
  constructor() {
    super("RECOVERY_REGISTRY_NOT_CONFIGURED");
    this.name = "RecoveryRegistryNotConfiguredError";
  }
}

/**
 * ScVal của `FwConstructorEntry::RecoveryRegistry(cooldown_secs)`.
 * Enum soroban một-biến-thể-có-payload mã hoá thành vec `[symbol, payload]`.
 */
export function recoveryRegistryEntryScVal(cooldownSecs: number): xdr.ScVal {
  return xdr.ScVal.scvVec([
    nativeToScVal("RecoveryRegistry", { type: "symbol" }),
    nativeToScVal(BigInt(cooldownSecs), { type: "u64" }),
  ]);
}

/**
 * `policies` truyền vào `kit.createWallet` để ví sinh ra đã nối registry.
 * Ném khi thiếu env: thà chặn TRƯỚC khi tạo passkey còn hơn đẻ ví cụt.
 */
export function recoveryConstructorPolicies(): PolicyConfig[] {
  const address = env.VITE_RECOVERY_REGISTRY_ADDRESS;
  if (!address) throw new RecoveryRegistryNotConfiguredError();
  return [
    {
      address,
      type: "custom",
      installParams: recoveryRegistryEntryScVal(env.VITE_RECOVERY_COOLDOWN_SECS),
    },
  ];
}
