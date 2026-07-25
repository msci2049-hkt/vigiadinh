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
    SmartAccountError, SmartAccountStorageKey,
};

mod registry_link;
pub use registry_link::{FwConstructorEntry, PendingRegistry};

/// Mã lỗi riêng của wrapper — bắt đầu 100 để không đè SmartAccountError của OZ.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FamilyWalletError {
    /// `recovery_rotate` khi chưa cắm registry.
    RecoveryNotConfigured = 100,
    /// Mọi chữ ký bị chối trong cửa sổ cooldown sau xoay khoá.
    CooldownActive = 101,
    /// Map `policies` của constructor chở nhiều hơn MỘT mục registry.
    DuplicateRecoveryEntry = 102,
    /// `set_recovery_registry` khi ĐÃ có registry — đổi phải đi đường timelock.
    RegistryAlreadyConfigured = 103,
    /// `apply`/`cancel` đổi registry khi không có đơn nào đang chờ.
    NoPendingRegistryChange = 104,
    /// `apply` khi timelock chưa hết.
    RegistryChangeNotDue = 105,
    /// `propose` chồng lên đơn đang chờ — huỷ đơn cũ trước.
    RegistryChangePending = 106,
    /// Huỷ đơn đổi registry bởi người không phải chủ ví lẫn registry hiện tại.
    NotAuthorizedToCancel = 107,
    /// Cooldown vượt trần `MAX_COOLDOWN_SECS` — chặn quả bom khoá-ví-vĩnh-viễn
    /// (audit P0-4).
    CooldownTooLong = 108,
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
    /// Đơn xin đổi registry đang chờ hết timelock ([`PendingRegistry`]).
    PendingRegistry,
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
    ///
    /// Nếu map `policies` chở mục [`FwConstructorEntry::RecoveryRegistry`] thì
    /// registry khôi phục được cắm NGAY trong tx này — ví sinh ra đã khôi phục
    /// được, không có cửa sổ "ví sống nhưng chưa nối registry".
    pub fn __constructor(e: &Env, signers: Vec<Signer>, policies: Map<Address, Val>) {
        let (recovery, policies) = registry_link::split_recovery_entry(e, &policies);
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
        if let Some((registry, cooldown_secs)) = recovery {
            registry_link::store(e, &registry, cooldown_secs);
        }
    }

    /// Thêm signer (vd nối vỏ mới) — chỉ chính tài khoản tự ký mới được đổi.
    pub fn batch_add_signer(e: &Env, context_rule_id: u32, signers: Vec<Signer>) {
        e.current_contract_address().require_auth();
        smart_account::batch_add_signer(e, context_rule_id, &signers);
    }

    /// Cắm registry LẦN ĐẦU cho ví chưa có (ví deploy trước bản constructor này,
    /// hoặc luồng test). Chỉ tài khoản tự ký (passkey chủ ví).
    ///
    /// ĐỔI registry đã có KHÔNG đi cửa này — nó phải qua timelock + veto
    /// (`propose_recovery_registry`), nếu không passkey chủ ví bị chiếm là kẻ
    /// tấn công trỏ ví sang registry của nó và cắt đứt người thân khỏi ví.
    pub fn set_recovery_registry(e: &Env, registry: Address, cooldown_secs: u64) {
        e.current_contract_address().require_auth();
        if registry_link::link(e).is_some() {
            panic_with_error!(e, FamilyWalletError::RegistryAlreadyConfigured);
        }
        registry_link::store(e, &registry, cooldown_secs);
    }

    pub fn get_recovery_registry(e: &Env) -> Option<(Address, u64)> {
        registry_link::link(e)
    }

    /// Xin ĐỔI registry — chủ ví tự ký, nhưng chỉ có hiệu lực sau timelock và
    /// người thân veto được trong cửa sổ đó (`RecoveryRegistry::veto_registry_change`).
    /// Không có timelock thì passkey chủ ví bị chiếm là kẻ tấn công trỏ ví sang
    /// registry của nó, cắt đứt đường cứu duy nhất mà không ai kịp biết.
    pub fn propose_recovery_registry(e: &Env, registry: Address, cooldown_secs: u64) {
        e.current_contract_address().require_auth();
        let apply_at = registry_link::propose(e, registry.clone(), cooldown_secs);
        e.events().publish(
            (symbol_short!("rl_prop"), e.current_contract_address()),
            (registry, apply_at),
        );
    }

    /// Áp đơn đã hết timelock. KHÔNG đòi auth: quyết định đã được chủ ví ký ở
    /// `propose`, timelock + veto là cổng gác — cùng khuôn `finalize_recovery`.
    pub fn apply_recovery_registry(e: &Env) {
        let registry = registry_link::apply_pending(e);
        e.events().publish(
            (symbol_short!("rl_apply"), e.current_contract_address()),
            registry,
        );
    }

    /// Huỷ đơn đổi registry. Hai người được huỷ: CHÍNH VÍ (chủ đổi ý) và
    /// REGISTRY HIỆN TẠI (người thân veto — registry là nơi biết ai là guardian,
    /// ví thì không). Registry gọi trực tiếp nên `require_auth` của nó là invoker
    /// auth, cùng khuôn `recovery_rotate`.
    pub fn cancel_recovery_registry_change(e: &Env, caller: Address) {
        caller.require_auth();
        let (registry, _) = registry_link::require_link(e);
        if caller != e.current_contract_address() && caller != registry {
            panic_with_error!(e, FamilyWalletError::NotAuthorizedToCancel);
        }
        registry_link::cancel_pending(e);
        e.events().publish(
            (symbol_short!("rl_cxl"), e.current_contract_address()),
            caller,
        );
    }

    /// Đơn đổi registry đang chờ (None = không có) — FE hiện cảnh báo + đếm ngược.
    pub fn pending_recovery_registry(e: &Env) -> Option<PendingRegistry> {
        registry_link::pending(e)
    }

    /// GIA HẠN TTL — chống "ví biến mất" sau nhiều tháng nằm im.
    ///
    /// Soroban archive entry hết TTL. OZ tự gia hạn entry persistent của nó MỖI
    /// LẦN ĐỌC (`storage.rs::get_persistent_entry`), nên ví đang được dùng tự
    /// lành. Nhưng ví thừa kế được thiết kế để nằm im nhiều tháng — không có lần
    /// đọc nào, và instance storage (dây nối registry, owner rule id, mốc xoay
    /// khoá) thì KHÔNG ai gia hạn cả. Hết TTL = tiền còn đó nhưng không ai mở
    /// được, đúng lúc gia đình cần nhất.
    ///
    /// Không đòi auth: gia hạn TTL không đổi được gì, ai trả phí cũng tốt (cron
    /// ví phí của app gọi — xem `be/src/jobs/ttl-keeper.ts`). Tự nó cũng là một
    /// lần đọc rule nên OZ gia hạn luôn phần persistent của rule chủ ví.
    pub fn extend_ttl(e: &Env, threshold: u32, extend_to: u32) {
        e.storage().instance().extend_ttl(threshold, extend_to);
        let rule_id = owner_rule_id(e);
        e.storage().persistent().extend_ttl(
            &SmartAccountStorageKey::ContextRuleData(rule_id),
            threshold,
            extend_to,
        );
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
        let old_ids = smart_account::get_context_rule(e, rule_id).signer_ids;
        // XOAY NGUYÊN TỬ giữ-một-neo — KHÔNG thêm-trước-xoá. Ví đã nối đủ 15 thiết bị
        // (trần MAX_SIGNERS của OZ) mà thêm trước thì `add_signer` panic `TooManySigners`
        // → rotate revert → đơn kẹt `Approved`, `initiate_recovery` bị `RecoveryInProgress`
        // chặn → ví KHÔNG BAO GIỜ cứu được nữa (B-SEC-1, hỏng vĩnh viễn). Thay bằng:
        // gỡ mọi signer cũ TRỪ một neo (rule không bao giờ rỗng, số signer tụt xuống 1),
        // rồi thêm signer mới (tối đa 2 — luôn dưới trần), rồi gỡ nốt neo. Không bước nào
        // đi qua trạng thái rỗng hay vượt trần.
        let mut anchor: Option<u32> = None;
        for old_signer_id in old_ids.iter() {
            match anchor {
                None => anchor = Some(old_signer_id),
                Some(_) => smart_account::remove_signer(e, rule_id, old_signer_id),
            }
        }
        smart_account::add_signer(e, rule_id, &new_signer);
        if let Some(anchor_id) = anchor {
            smart_account::remove_signer(e, rule_id, anchor_id);
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
