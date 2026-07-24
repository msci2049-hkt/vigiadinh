//! Contract SEP-45 — `web_auth_verify` (PHA 2.3).
//!
//! Backend dựng challenge = các SorobanAuthorizationEntry mà root invocation là
//! `web_auth_verify(args)` trên contract này (không sub-invocation). Contract chỉ làm
//! đúng theo spec sep-0045.md:
//!   1. `require_auth` trên `account` (ví contract của người dùng — ký qua `__check_auth`)
//!   2. `require_auth` trên `web_auth_domain_account` (SIGNING_KEY của server)
//!   3. nếu có `client_domain_account` → `require_auth` thêm địa chỉ đó
//! Mọi args còn lại (`home_domain`, `web_auth_domain`, `nonce`, `client_domain`)
//! contract BỎ QUA — server mới là bên validate chúng (spec: "All other arguments
//! are ignored by the contract"). Nonce nằm trong args để hai entry cùng challenge
//! ràng nhau và server chống replay ở tầng HTTP.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, Address, Env, Map, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WebAuthError {
    /// Thiếu args bắt buộc `account`.
    MissingAccount = 1,
    /// Thiếu args bắt buộc `web_auth_domain_account`.
    MissingServerAccount = 2,
}

#[contract]
pub struct WebAuthContract;

#[contractimpl]
impl WebAuthContract {
    /// Điểm neo xác thực SEP-45. Chữ ký hàm phải giữ đúng tên/args theo spec
    /// vì server-khác (anchor, wallet bên thứ ba) nhận diện qua `function_name`.
    pub fn web_auth_verify(env: Env, args: Map<Symbol, String>) {
        let account = args
            .get(Symbol::new(&env, "account"))
            .unwrap_or_else(|| panic_with_error!(&env, WebAuthError::MissingAccount));
        Address::from_string(&account).require_auth();

        let server_account = args
            .get(Symbol::new(&env, "web_auth_domain_account"))
            .unwrap_or_else(|| panic_with_error!(&env, WebAuthError::MissingServerAccount));
        Address::from_string(&server_account).require_auth();

        if let Some(client_domain_account) = args.get(Symbol::new(&env, "client_domain_account")) {
            Address::from_string(&client_domain_account).require_auth();
        }
    }
}

#[cfg(test)]
mod test;
