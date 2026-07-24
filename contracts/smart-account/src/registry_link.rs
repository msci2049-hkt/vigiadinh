//! Dây nối ví ↔ registry khôi phục: cắm lần đầu (constructor) + ĐỔI có timelock.
//!
//! Vì sao đổi registry phải có timelock + veto, trong khi cắm lần đầu thì không:
//! lúc deploy chưa có ai để bảo vệ và chưa có tiền trong ví. Sau đó, registry là
//! thứ DUY NHẤT cứu được ví khi chủ mất máy — ai đổi được nó là cắt được người
//! thân khỏi ví. Passkey chủ ví bị chiếm mà đổi registry ngay lập tức thì kẻ tấn
//! công vừa giữ ví vừa vô hiệu hoá đường cứu. Timelock cho người thân nhìn thấy
//! và chặn; veto cho họ chặn thật.
use soroban_sdk::{contracttype, panic_with_error, Address, Env, Map, TryFromVal, Val};

use crate::{FamilyWalletError, FwDataKey};

/// Cửa sổ chờ trước khi đổi registry có hiệu lực. Đủ dài để người thân nhận
/// thông báo và phản ứng, kể cả khi họ không mở app hằng ngày.
pub(crate) const REGISTRY_CHANGE_DELAY_SECS: u64 = 604_800; // 7 ngày

/// Mục ĐẶT CHỖ nhét vào map `policies` của constructor để cắm registry khôi phục
/// NGAY TRONG tx deploy.
///
/// Vì sao phải lách qua map `policies`: `smart-account-kit` — đường deploy của
/// sản phẩm — khoá cứng constructor đúng HAI tham số `{signers, policies}`
/// (`kit/deploy-ops.js` → `SmartAccountClient.deploy`), nên không thêm được
/// tham số thứ ba mà không fork kit. Khoá của mục = địa chỉ registry (đúng kiểu
/// `Address` mà map đòi), giá trị = enum này.
///
/// Vì sao KHÔNG để việc cắm thành tx riêng sau deploy: tx thứ hai fail = ví sinh
/// ra VĨNH VIỄN không khôi phục được, và không ai biết cho tới đúng lúc cần nó.
/// Cắm trong constructor thì deploy hoặc xong cả hai, hoặc không có ví nào cả.
///
/// `__constructor` GỠ mục này ra trước khi đưa phần còn lại cho OZ — để lọt là
/// OZ gọi `install()` lên registry (`add_context_rule` cài MỌI key trong map)
/// và deploy chết.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FwConstructorEntry {
    /// Cắm registry khôi phục; tham số = cooldown (giây) sau khi xoay khoá.
    RecoveryRegistry(u64),
}

/// Đơn xin đổi registry đang chờ hết timelock.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingRegistry {
    pub registry: Address,
    pub cooldown_secs: u64,
    /// Timestamp sớm nhất được `apply`.
    pub apply_at: u64,
}

/// Tách mục registry ĐẶT CHỖ khỏi map policy thật.
///
/// Val nào không giải mã được thành [`FwConstructorEntry`] thì là policy thật —
/// giữ nguyên, trả về cho OZ. Policy thật của OZ mang install-params dạng map
/// symbol (`threshold`, `period_ledgers`…), không bao giờ trùng khuôn enum này.
pub(crate) fn split_recovery_entry(
    e: &Env,
    policies: &Map<Address, Val>,
) -> (Option<(Address, u64)>, Map<Address, Val>) {
    let mut rest: Map<Address, Val> = Map::new(e);
    let mut found: Option<(Address, u64)> = None;
    for (addr, val) in policies.iter() {
        match FwConstructorEntry::try_from_val(e, &val) {
            Ok(FwConstructorEntry::RecoveryRegistry(cooldown_secs)) => {
                if found.is_some() {
                    panic_with_error!(e, FamilyWalletError::DuplicateRecoveryEntry);
                }
                found = Some((addr, cooldown_secs));
            }
            Err(_) => rest.set(addr, val),
        }
    }
    (found, rest)
}

pub(crate) fn link(e: &Env) -> Option<(Address, u64)> {
    e.storage().instance().get(&FwDataKey::RecoveryRegistry)
}

pub(crate) fn require_link(e: &Env) -> (Address, u64) {
    link(e).unwrap_or_else(|| panic_with_error!(e, FamilyWalletError::RecoveryNotConfigured))
}

pub(crate) fn store(e: &Env, registry: &Address, cooldown_secs: u64) {
    e.storage().instance().set(
        &FwDataKey::RecoveryRegistry,
        &(registry.clone(), cooldown_secs),
    );
}

pub(crate) fn pending(e: &Env) -> Option<PendingRegistry> {
    e.storage().instance().get(&FwDataKey::PendingRegistry)
}

/// Ghi đơn xin đổi. Trả `apply_at` để caller phát event.
pub(crate) fn propose(e: &Env, registry: Address, cooldown_secs: u64) -> u64 {
    // Phải ĐANG có registry — ví chưa cắm thì dùng `set_recovery_registry`
    // (không có gì để bảo vệ, và bắt chờ 7 ngày là vô nghĩa).
    let _ = require_link(e);
    if pending(e).is_some() {
        panic_with_error!(e, FamilyWalletError::RegistryChangePending);
    }
    let apply_at = e
        .ledger()
        .timestamp()
        .saturating_add(REGISTRY_CHANGE_DELAY_SECS);
    e.storage().instance().set(
        &FwDataKey::PendingRegistry,
        &PendingRegistry {
            registry,
            cooldown_secs,
            apply_at,
        },
    );
    apply_at
}

/// Áp đơn đã hết timelock. Trả registry mới để caller phát event.
pub(crate) fn apply_pending(e: &Env) -> Address {
    let p = pending(e)
        .unwrap_or_else(|| panic_with_error!(e, FamilyWalletError::NoPendingRegistryChange));
    if e.ledger().timestamp() < p.apply_at {
        panic_with_error!(e, FamilyWalletError::RegistryChangeNotDue);
    }
    store(e, &p.registry, p.cooldown_secs);
    e.storage().instance().remove(&FwDataKey::PendingRegistry);
    p.registry
}

pub(crate) fn cancel_pending(e: &Env) {
    if pending(e).is_none() {
        panic_with_error!(e, FamilyWalletError::NoPendingRegistryChange);
    }
    e.storage().instance().remove(&FwDataKey::PendingRegistry);
}
