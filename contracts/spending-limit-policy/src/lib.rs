//! FamilyWallet Spending-Limit Policy — VỎ MỎNG quanh module có sẵn của
//! OpenZeppelin (`stellar_accounts::policies::spending_limit`, LÔ 3).
//!
//! KHÔNG viết lại logic: toàn bộ đo đếm (rolling window theo ledger, evict
//! entry cũ, cache tổng chi, trần lịch sử chống DoS) là code OZ 0.7.2 nguyên
//! bản — file này chỉ phơi các hàm module thành một contract độc lập để ví
//! (`smart-account`) gắn qua `add_policy`/`add_context_rule`.
//!
//! Ràng buộc THIẾT KẾ của OZ phải biết khi dùng (docs/AUDIT §2.3 + evidence):
//! - `install` CHỈ nhận context rule kiểu `CallContract(token)` (mã 3227) —
//!   policy pin vào MỘT token (mọi transfer đo cùng đơn vị). KHÔNG gắn được
//!   vào rule Default (rule 0 "owner") của ví đang tồn tại.
//! - Hệ quả trung thực: ví có rule Default không policy thì người ký vẫn CHỌN
//!   được rule 0 cho SAC transfer (do_check_auth cho phép Default match mọi
//!   context) → hạn mức là ràng buộc THEO ĐƯỜNG KÝ, chưa tuyệt đối. Chặn tuyệt
//!   đối cần policy tuỳ biến cho rule Default — nợ đã khai, KHÔNG làm ở lô này.
//! - `enforce` chỉ nhận context `transfer(from, to, amount)`; context khác →
//!   panic NotAllowed (3223) — đúng ý: rule gắn policy này chỉ dành cho tiền.
//! - Vượt hạn mức (đơn lẻ hoặc CỘNG DỒN trong cửa sổ) → panic 3221
//!   `SpendingLimitExceeded` — giao dịch chết ở __check_auth, không ai vượt
//!   được bằng cách đi vòng backend.
#![no_std]

use soroban_sdk::{auth::Context, contract, contractimpl, Address, Env, Vec};
use stellar_accounts::{
    policies::spending_limit::{self, SpendingLimitAccountParams, SpendingLimitData},
    smart_account::{ContextRule, Signer},
};

#[contract]
pub struct SpendingLimitPolicy;

#[contractimpl]
impl SpendingLimitPolicy {
    /// Gọi bởi `do_check_auth` của ví trong lúc xác thực chữ ký — invoker là
    /// chính ví nên `smart_account.require_auth()` bên trong OZ tự thoả
    /// (invoker auth, cùng khuôn `recovery_rotate`).
    pub fn enforce(
        e: Env,
        context: Context,
        authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::enforce(
            &e,
            &context,
            &authenticated_signers,
            &context_rule,
            &smart_account,
        );
    }

    /// Gọi bởi ví khi `add_policy`/`add_context_rule` (ví tự ký qua passkey).
    pub fn install(
        e: Env,
        install_params: SpendingLimitAccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::install(&e, &install_params, &context_rule, &smart_account);
    }

    /// Gọi bởi ví khi `remove_policy` — dọn state của (ví, rule).
    pub fn uninstall(e: Env, context_rule: ContextRule, smart_account: Address) {
        spending_limit::uninstall(&e, &context_rule, &smart_account);
    }

    /// View cho FE/BE: hạn mức + cửa sổ + tổng đã chi trong kỳ.
    pub fn get_spending_limit_data(
        e: Env,
        context_rule_id: u32,
        smart_account: Address,
    ) -> SpendingLimitData {
        spending_limit::get_spending_limit_data(&e, context_rule_id, &smart_account)
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
