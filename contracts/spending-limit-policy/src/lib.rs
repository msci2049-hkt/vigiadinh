//! FamilyWallet Spending-Limit Policy — VỎ MỎNG quanh module có sẵn của
//! OpenZeppelin (`stellar_accounts::policies::spending_limit`, LÔ 3) + đường
//! install riêng cho rule DEFAULT (vá nợ ca 5 — bypass qua rule 0).
//!
//! KHÔNG viết lại logic đo đếm: rolling window theo ledger, evict entry cũ,
//! cache tổng chi, trần lịch sử chống DoS đều là code OZ 0.7.2 nguyên bản —
//! file này phơi các hàm module thành contract độc lập để ví (`smart-account`)
//! gắn qua `add_policy`/`add_context_rule`.
//!
//! HAI ĐƯỜNG INSTALL (phân theo `context_rule.context_type`):
//! - `CallContract(token)` → OZ nguyên bản ([`SpendingLimitAccountParams`]):
//!   policy pin vào token của rule; `enforce` chỉ cho `transfer` (đo), mọi fn
//!   khác chết NotAllowed (3223).
//! - `Default` → đường riêng của vỏ ([`DefaultInstallParams`] chở thêm `token`
//!   vì rule Default không nói token nào): ghi cùng storage shape OZ nên đo
//!   đếm/`set_spending_limit`/`get_spending_limit_data` dùng chung. `enforce`
//!   trên rule Default phân nhánh theo context:
//!   * gọi ĐÚNG token đo: `transfer` → OZ đo (vượt = 3221); fn khác trên token
//!     (`approve`/`burn`…) → chết NotAllowed — chặn đường lách "approve không
//!     giới hạn rồi transfer_from".
//!   * gọi contract KHÁC (admin ops trên chính ví: add_context_rule, propose
//!     registry…; contract ngoài): CHO QUA — policy hạn mức chỉ quản tiền,
//!     không được khoá cứng quyền quản trị ví (rule 0 là rule quản trị duy nhất).
//!   Sub-invocation không thoát được: Soroban đưa MỌI context của cây auth vào
//!   `__check_auth`, nên `transfer` lồng trong call contract ngoài vẫn hiện ra
//!   như một context riêng và vẫn bị đo.
//!
//! Phạm vi trung thực: hạn mức đo MỘT token (thiết kế OZ — mọi transfer cùng
//! đơn vị). Ví giữ token khác ngoài token đo thì token đó KHÔNG bị hạn mức.
#![no_std]

use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contractimpl, contracttype, panic_with_error, Address, Env, TryFromVal, Val, Vec,
};
use stellar_accounts::{
    policies::spending_limit::{
        self, SpendingLimitAccountParams, SpendingLimitData, SpendingLimitError,
        SpendingLimitInstalled, SpendingLimitStorageKey, SPENDING_LIMIT_EXTEND_AMOUNT,
        SPENDING_LIMIT_TTL_THRESHOLD,
    },
    smart_account::{ContextRule, ContextRuleType, Signer},
};

/// Params cho install lên rule DEFAULT — OZ chối Default (3227) vì không biết
/// token nào để đo, nên vỏ nhận token TƯỜNG MINH thay vì lấy từ rule.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DefaultInstallParams {
    pub spending_limit: i128,
    pub period_ledgers: u32,
    /// Token bị đo (SAC XLM trong sản phẩm) — `enforce` chỉ đo/chặn call vào
    /// đúng địa chỉ này, context khác cho qua.
    pub token: Address,
}

/// Storage riêng của vỏ — CHỈ dùng cho install đường Default.
#[contracttype]
#[derive(Clone)]
pub enum FwPolicyKey {
    /// (ví, rule_id) → token được đo. Có mặt = rule đó install đường Default.
    MeteredToken(Address, u32),
}

fn metered_token(e: &Env, smart_account: &Address, rule_id: u32) -> Option<Address> {
    let key = FwPolicyKey::MeteredToken(smart_account.clone(), rule_id);
    e.storage().persistent().get(&key).inspect(|_: &Address| {
        e.storage().persistent().extend_ttl(
            &key,
            SPENDING_LIMIT_TTL_THRESHOLD,
            SPENDING_LIMIT_EXTEND_AMOUNT,
        );
    })
}

#[contract]
pub struct SpendingLimitPolicy;

#[contractimpl]
impl SpendingLimitPolicy {
    /// Gọi bởi `do_check_auth` của ví trong lúc xác thực chữ ký — invoker là
    /// chính ví nên `smart_account.require_auth()` bên trong tự thoả
    /// (invoker auth, cùng khuôn `recovery_rotate`).
    pub fn enforce(
        e: Env,
        context: Context,
        authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        let Some(token) = metered_token(&e, &smart_account, context_rule.id) else {
            // Đường CallContract nguyên bản OZ: chỉ transfer, đo, vượt = 3221.
            spending_limit::enforce(
                &e,
                &context,
                &authenticated_signers,
                &context_rule,
                &smart_account,
            );
            return;
        };

        // Đường Default: phân nhánh theo context. KHÔNG require_auth ở đây
        // rồi lại giao OZ enforce — OZ cũng require_auth, hai lần cùng frame
        // là Auth ExistingValue.
        match &context {
            Context::Contract(ContractContext { contract, .. }) if *contract == token => {
                // transfer → OZ đo (3221 khi vượt); approve/burn/fn khác trên
                // token → OZ chối 3223: đóng đường lách allowance. require_auth
                // + kiểm signer rỗng nằm trong OZ.
                spending_limit::enforce(
                    &e,
                    &context,
                    &authenticated_signers,
                    &context_rule,
                    &smart_account,
                );
            }
            // Context không đụng token đo (quản trị ví, contract ngoài): cho
            // qua — mọi transfer lồng bên dưới vẫn nổi lên thành context riêng.
            // Giữ nguyên ràng buộc auth của OZ trên nhánh này.
            _ => {
                smart_account.require_auth();
                if authenticated_signers.is_empty() {
                    panic_with_error!(&e, SpendingLimitError::NotAllowed)
                }
            }
        }
    }

    /// Gọi bởi ví khi `add_policy`/`add_context_rule` (ví tự ký qua passkey).
    /// Nhận `Val` vì hai đường install có shape params khác nhau; phân nhánh
    /// theo kiểu rule — KHÔNG theo shape client gửi (fail-closed).
    pub fn install(e: Env, install_params: Val, context_rule: ContextRule, smart_account: Address) {
        match context_rule.context_type {
            ContextRuleType::Default => {
                smart_account.require_auth();
                let params = DefaultInstallParams::try_from_val(&e, &install_params)
                    .unwrap_or_else(|_| {
                        panic_with_error!(&e, SpendingLimitError::InvalidLimitOrPeriod)
                    });
                if params.spending_limit <= 0 || params.period_ledgers == 0 {
                    panic_with_error!(&e, SpendingLimitError::InvalidLimitOrPeriod)
                }
                let key =
                    SpendingLimitStorageKey::AccountContext(smart_account.clone(), context_rule.id);
                if e.storage().persistent().has(&key) {
                    panic_with_error!(&e, SpendingLimitError::AlreadyInstalled)
                }
                let data = SpendingLimitData {
                    spending_limit: params.spending_limit,
                    period_ledgers: params.period_ledgers,
                    spending_history: Vec::new(&e),
                    cached_total_spent: 0,
                };
                e.storage().persistent().set(&key, &data);
                e.storage().persistent().set(
                    &FwPolicyKey::MeteredToken(smart_account.clone(), context_rule.id),
                    &params.token,
                );
                SpendingLimitInstalled {
                    smart_account,
                    context_rule_id: context_rule.id,
                    spending_limit: params.spending_limit,
                    period_ledgers: params.period_ledgers,
                }
                .publish(&e);
            }
            _ => {
                let params = SpendingLimitAccountParams::try_from_val(&e, &install_params)
                    .unwrap_or_else(|_| {
                        panic_with_error!(&e, SpendingLimitError::InvalidLimitOrPeriod)
                    });
                spending_limit::install(&e, &params, &context_rule, &smart_account);
            }
        }
    }

    /// Gọi bởi ví khi `remove_policy` — dọn state của (ví, rule), cả hai đường.
    pub fn uninstall(e: Env, context_rule: ContextRule, smart_account: Address) {
        spending_limit::uninstall(&e, &context_rule, &smart_account);
        let mkey = FwPolicyKey::MeteredToken(smart_account.clone(), context_rule.id);
        if e.storage().persistent().has(&mkey) {
            e.storage().persistent().remove(&mkey);
        }
    }

    /// View cho FE/BE: hạn mức + cửa sổ + tổng đã chi trong kỳ (chung 2 đường).
    pub fn get_spending_limit_data(
        e: Env,
        context_rule_id: u32,
        smart_account: Address,
    ) -> SpendingLimitData {
        spending_limit::get_spending_limit_data(&e, context_rule_id, &smart_account)
    }

    /// View: token đang bị đo trên rule Default (None = rule đó đi đường
    /// CallContract hoặc chưa install).
    pub fn get_metered_token(
        e: Env,
        context_rule_id: u32,
        smart_account: Address,
    ) -> Option<Address> {
        metered_token(&e, &smart_account, context_rule_id)
    }

    /// Đổi hạn mức — OZ đòi chính VÍ ký (`smart_account.require_auth`), tức là
    /// passkey chủ ví; backend không có đường sửa.
    pub fn set_spending_limit(
        e: Env,
        spending_limit_value: i128,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::set_spending_limit(&e, spending_limit_value, &context_rule, &smart_account);
    }
}

#[cfg(test)]
mod test;
