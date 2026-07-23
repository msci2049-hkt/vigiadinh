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
#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    Address, Env, Map, String, Symbol, Val, Vec,
};
use stellar_accounts::smart_account::{
    self, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount,
    SmartAccountError,
};

#[contract]
pub struct FamilyWalletAccount;

#[contractimpl]
impl FamilyWalletAccount {
    /// Rule mặc định với signers (thường: External passkey) + policies của người dùng.
    pub fn __constructor(e: &Env, signers: Vec<Signer>, policies: Map<Address, Val>) {
        smart_account::add_context_rule(
            e,
            &ContextRuleType::Default,
            &String::from_str(e, "owner"),
            None,
            &signers,
            &policies,
        );
    }

    /// Thêm signer (vd nối vỏ mới) — chỉ chính tài khoản tự ký mới được đổi.
    pub fn batch_add_signer(e: &Env, context_rule_id: u32, signers: Vec<Signer>) {
        e.current_contract_address().require_auth();
        smart_account::batch_add_signer(e, context_rule_id, &signers);
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
        smart_account::do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for FamilyWalletAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for FamilyWalletAccount {}

#[cfg(test)]
mod test;
