//! FamilyWallet Smart Account — ví contract của MỖI người dùng (PHA 2.2).
//!
//! Wrap OZ `stellar_accounts::smart_account`: signers (External passkey qua
//! origin-verifier) + context rules (scope + expiration) + policies (threshold,
//! spending limit, recovery/inheritance/care ở pha sau). Custody nằm ở đây —
//! backend sập không ai mất tiền (luật security §1).
//!
//! Deploy: WASM hash + constructor args (signers, policies) — mỗi hộ MỘT instance,
//! KHÔNG có contract ID cố định dùng chung (skill passkey §0).
//!
//! Extension = context rule quyền HẸP + `valid_until` (expiration) — mất laptop chỉ
//! cần gỡ đúng signer đó, các vỏ khác sống (skill passkey §1). Việc dựng rule hẹp cụ
//! thể nằm ở PHA 9 (extension); ở đây account đã có đủ API `add_context_rule`.
//!
//! KHÔI PHỤC (audit P0 2026-07-24): registry recovery là NGƯỜI DUY NHẤT được xoay
//! signer, qua ĐÚNG MỘT cửa `recovery_rotate` (invoker auth — registry gọi trực
//! tiếp). Địa chỉ ví KHÔNG đổi, tiền KHÔNG di chuyển — chỉ khoá bên trong đổi.
//! Sau xoay có COOLDOWN: `__check_auth` chối MỌI chữ ký tới khi hết cửa sổ
//! (chống xoay-rồi-rút-ngay — docs Stellar "advanced contract account patterns").
#![no_std]
// events().publish cùng wire format với registry v1/v2 (xem recovery-registry).
#![allow(deprecated)]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    panic_with_error, symbol_short, Address, Env, Map, String, Symbol, Val, Vec,
};
use stellar_accounts::smart_account::{
    self, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount,
    SmartAccountError,
};

/// Mã lỗi riêng của wrapper — bắt đầu 100 để không đè SmartAccountError của OZ.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FamilyWalletError {
    /// `recovery_rotate` khi chưa `set_recovery_registry`.
    RecoveryNotConfigured = 100,
    /// Mọi chữ ký bị chối trong cửa sổ cooldown sau xoay khoá.
    CooldownActive = 101,
}

#[contracttype]
#[derive(Clone)]
pub enum FwDataKey {
    /// (registry Address, cooldown_secs u64) — ai được xoay khoá + nghỉ bao lâu.
    RecoveryRegistry,
    /// Rule chứa signer chủ ví (tạo ở constructor) — đích của recovery_rotate.
    OwnerRuleId,
    /// Timestamp lần xoay khoá gần nhất (mốc tính cooldown).
    LastRotation,
}

#[contract]
pub struct FamilyWalletAccount;

fn owner_rule_id(e: &Env) -> u32 {
    // Constructor luôn ghi — thiếu chỉ khi storage hỏng, panic mã OZ chuẩn.
    e.storage()
        .instance()
        .get(&FwDataKey::OwnerRuleId)
        .unwrap_or_else(|| panic_with_error!(e, SmartAccountError::ContextRuleNotFound))
}

#[contractimpl]
impl FamilyWalletAccount {
    /// Rule mặc định với signers (thường: External passkey) + policies của người dùng.
    pub fn __constructor(e: &Env, signers: Vec<Signer>, policies: Map<Address, Val>) {
        let rule = smart_account::add_context_rule(
            e,
            &ContextRuleType::Default,
            &String::from_str(e, "owner"),
            None,
            &signers,
            &policies,
        );
        e.storage()
            .instance()
            .set(&FwDataKey::OwnerRuleId, &rule.id);
    }

    /// Thêm signer (vd nối vỏ mới) — chỉ chính tài khoản tự ký mới được đổi.
    pub fn batch_add_signer(e: &Env, context_rule_id: u32, signers: Vec<Signer>) {
        e.current_contract_address().require_auth();
        smart_account::batch_add_signer(e, context_rule_id, &signers);
    }

    /// Trỏ registry recovery + độ dài cooldown. Chỉ tài khoản tự ký (passkey chủ ví).
    /// Gỡ quyền = trỏ sang registry khác hoặc đặt lại — cùng cửa tự-ký này.
    pub fn set_recovery_registry(e: &Env, registry: Address, cooldown_secs: u64) {
        e.current_contract_address().require_auth();
        e.storage()
            .instance()
            .set(&FwDataKey::RecoveryRegistry, &(registry, cooldown_secs));
    }

    pub fn get_recovery_registry(e: &Env) -> Option<(Address, u64)> {
        e.storage().instance().get(&FwDataKey::RecoveryRegistry)
    }

    /// Timestamp lần xoay khoá gần nhất (None = chưa từng xoay).
    pub fn last_rotation(e: &Env) -> Option<u64> {
        e.storage().instance().get(&FwDataKey::LastRotation)
    }

    /// XOAY KHOÁ KHÔI PHỤC — cửa DUY NHẤT registry được đụng signer, và là việc
    /// DUY NHẤT registry làm được ở đây (không rút tiền, không đổi rule/policy).
    /// Auth = invoker: registry (contract) gọi trực tiếp nên `require_auth` của
    /// chính nó tự thoả — không cần craft auth entry delegated (skill passkey §0
    /// cảnh báo simulation không trả entry đó).
    ///
    /// Thay TOÀN BỘ signer của owner-rule bằng `new_signer` (mọi thiết bị cũ coi
    /// như mất — đúng ngữ nghĩa social recovery), rồi đóng dấu LastRotation để
    /// `__check_auth` mở cửa sổ cooldown. Rule khác (vd extension, quyền hẹp +
    /// valid_until) không đụng — chúng tự hết hạn; ghi rõ trong threat model.
    pub fn recovery_rotate(e: &Env, new_signer: Signer) {
        let (registry, _): (Address, u64) = e
            .storage()
            .instance()
            .get(&FwDataKey::RecoveryRegistry)
            .unwrap_or_else(|| panic_with_error!(e, FamilyWalletError::RecoveryNotConfigured));
        registry.require_auth();

        let rule_id = owner_rule_id(e);
        let old = smart_account::get_context_rule(e, rule_id);
        // Thêm mới TRƯỚC, gỡ cũ SAU — rule không bao giờ rỗng signer (OZ chặn).
        smart_account::add_signer(e, rule_id, &new_signer);
        for old_signer_id in old.signer_ids.iter() {
            smart_account::remove_signer(e, rule_id, old_signer_id);
        }

        let now = e.ledger().timestamp();
        e.storage().instance().set(&FwDataKey::LastRotation, &now);
        e.events()
            .publish((symbol_short!("rotate"), e.current_contract_address()), now);
    }
}

#[contractimpl]
impl CustomAccountInterface for FamilyWalletAccount {
    type Error = SmartAccountError;
    type Signature = AuthPayload;

    fn __check_auth(
        e: Env,
        signature_payload: Hash<32>,
        signatures: AuthPayload,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Self::Error> {
        // Cooldown sau xoay khoá: chối MỌI chữ ký (kể cả khoá mới) tới hết cửa sổ.
        // Khôi phục bị chiếm vẫn cứu được: guardian mở recovery TIẾP theo qua
        // registry — đường đó không đi qua __check_auth của ví.
        if let Some(last) = e
            .storage()
            .instance()
            .get::<_, u64>(&FwDataKey::LastRotation)
        {
            let cooldown = e
                .storage()
                .instance()
                .get::<_, (Address, u64)>(&FwDataKey::RecoveryRegistry)
                .map(|(_, cd)| cd)
                .unwrap_or(0);
            if e.ledger().timestamp() < last.saturating_add(cooldown) {
                panic_with_error!(&e, FamilyWalletError::CooldownActive);
            }
        }
        smart_account::do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for FamilyWalletAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for FamilyWalletAccount {}

#[cfg(test)]
mod test;
