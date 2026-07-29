//! Test vỏ contract (logic đo đếm đã có test upstream trong OZ 0.7.2 —
//! ở đây chứng minh vỏ nối đúng CẢ HAI đường install:
//! - CallContract: install qua client, enforce cộng dồn, vượt = 3221.
//! - Default (vá ca 5): đo transfer trên token pin, chặn approve/burn trên
//!   token (3223), CHO QUA context khác (quản trị ví không bị khoá), dọn
//!   sạch khi uninstall.
#![cfg(test)]

use soroban_sdk::{
    auth::{Context, ContractContext},
    symbol_short,
    testutils::{Address as _, Ledger},
    Address, Env, IntoVal, String, Symbol, Val, Vec,
};
use stellar_accounts::{
    policies::spending_limit::SpendingLimitAccountParams,
    smart_account::{ContextRule, ContextRuleType, Signer},
};

use crate::{DefaultInstallParams, SpendingLimitPolicy, SpendingLimitPolicyClient};

fn rule(e: &Env, context_type: ContextRuleType, signer: &Address) -> ContextRule {
    let mut signers = Vec::new(e);
    signers.push_back(Signer::Delegated(signer.clone()));
    ContextRule {
        id: 1,
        context_type,
        name: String::from_str(e, "spend-limit"),
        signers,
        signer_ids: Vec::new(e),
        policies: Vec::new(e),
        policy_ids: Vec::new(e),
        valid_until: None,
    }
}

fn call_ctx(e: &Env, contract: &Address, fn_name: Symbol, amount: Option<i128>) -> Context {
    let from = Address::generate(e);
    let to = Address::generate(e);
    let mut args = Vec::new(e);
    args.push_back(from.into_val(e));
    args.push_back(to.into_val(e));
    if let Some(a) = amount {
        args.push_back(a.into_val(e));
    }
    Context::Contract(ContractContext {
        contract: contract.clone(),
        fn_name,
        args,
    })
}

fn transfer_ctx(e: &Env, sac: &Address, amount: i128) -> Context {
    call_ctx(e, sac, symbol_short!("transfer"), Some(amount))
}

struct Setup {
    e: Env,
    client_addr: Address,
    account: Address,
    sac: Address,
    signer: Address,
}

fn setup() -> Setup {
    let e = Env::default();
    e.mock_all_auths();
    let client_addr = e.register(SpendingLimitPolicy, ());
    let account = Address::generate(&e);
    let sac = Address::generate(&e);
    let signer = Address::generate(&e);
    Setup {
        e,
        client_addr,
        account,
        sac,
        signer,
    }
}

fn signers_of(s: &Setup) -> Vec<Signer> {
    let mut signers = Vec::new(&s.e);
    signers.push_back(Signer::Delegated(s.signer.clone()));
    signers
}

#[test]
fn install_then_enforce_within_limit_and_cumulative_block() {
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(
        &s.e,
        ContextRuleType::CallContract(s.sac.clone()),
        &s.signer,
    );
    let params: Val = SpendingLimitAccountParams {
        spending_limit: 500,
        period_ledgers: 100,
    }
    .into_val(&s.e);

    client.install(&params, &r, &s.account);
    let data = client.get_spending_limit_data(&r.id, &s.account);
    assert_eq!(data.spending_limit, 500);
    assert_eq!(data.cached_total_spent, 0);

    // Ledger 0 làm cutoff `seq <= current - period` (saturating) evict ngay
    // entry vừa ghi — đặt mốc > period cho giống ledger thật.
    s.e.ledger().with_mut(|l| l.sequence_number = 1_000);

    // 100 + 300 = 400 ≤ 500 → qua; tổng được cộng dồn.
    let signers = signers_of(&s);
    client.enforce(&transfer_ctx(&s.e, &s.sac, 100), &signers, &r, &s.account);
    client.enforce(&transfer_ctx(&s.e, &s.sac, 300), &signers, &r, &s.account);
    assert_eq!(
        client
            .get_spending_limit_data(&r.id, &s.account)
            .cached_total_spent,
        400
    );

    // Thêm 200 → 600 > 500: CHẾT đúng mã 3221 (SpendingLimitExceeded).
    let res = client.try_enforce(&transfer_ctx(&s.e, &s.sac, 200), &signers, &r, &s.account);
    assert!(res.is_err(), "vượt hạn mức cộng dồn phải bị chối");

    // Qua cửa sổ (period 100 ledger) → entry cũ bị evict, chi lại được.
    s.e.ledger().with_mut(|l| l.sequence_number += 200);
    client.enforce(&transfer_ctx(&s.e, &s.sac, 450), &signers, &r, &s.account);
    assert_eq!(
        client
            .get_spending_limit_data(&r.id, &s.account)
            .cached_total_spent,
        450
    );
}

#[test]
fn install_on_default_rule_with_oz_params_rejected() {
    // Đường Default đòi DefaultInstallParams (có token). Shape OZ 2 trường
    // không nói token nào để đo → chối (fail-closed), không đoán mò.
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    let params: Val = SpendingLimitAccountParams {
        spending_limit: 500,
        period_ledgers: 100,
    }
    .into_val(&s.e);
    let res = client.try_install(&params, &r, &s.account);
    assert!(
        res.is_err(),
        "install Default thiếu token phải bị chối (shape sai)"
    );
}

fn install_default(s: &Setup, client: &SpendingLimitPolicyClient, r: &ContextRule) {
    let params: Val = DefaultInstallParams {
        spending_limit: 500,
        period_ledgers: 100,
        token: s.sac.clone(),
    }
    .into_val(&s.e);
    client.install(&params, r, &s.account);
}

#[test]
fn default_install_meters_token_transfer_and_blocks_over_limit() {
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    install_default(&s, &client, &r);
    assert_eq!(
        client.get_metered_token(&r.id, &s.account),
        Some(s.sac.clone())
    );

    s.e.ledger().with_mut(|l| l.sequence_number = 1_000);
    let signers = signers_of(&s);

    // Dưới hạn mức → qua và CỘNG DỒN (đo thật, không phải cho qua suông).
    client.enforce(&transfer_ctx(&s.e, &s.sac, 400), &signers, &r, &s.account);
    assert_eq!(
        client
            .get_spending_limit_data(&r.id, &s.account)
            .cached_total_spent,
        400
    );

    // 400 + 200 = 600 > 500 → chết 3221 — ĐÂY là nợ ca 5 được vá: rule
    // Default không còn là đường ký vượt hạn mức.
    let res = client.try_enforce(&transfer_ctx(&s.e, &s.sac, 200), &signers, &r, &s.account);
    assert!(res.is_err(), "rule Default vượt hạn mức phải bị chối");
}

#[test]
fn default_blocks_non_transfer_on_metered_token() {
    // approve trên token đo phải CHẾT (3223) — không thì lách được bằng
    // "approve không giới hạn rồi transfer_from ngoài tầm __check_auth".
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    install_default(&s, &client, &r);
    s.e.ledger().with_mut(|l| l.sequence_number = 1_000);
    let res = client.try_enforce(
        &call_ctx(&s.e, &s.sac, symbol_short!("approve"), Some(1_000_000)),
        &signers_of(&s),
        &r,
        &s.account,
    );
    assert!(res.is_err(), "approve trên token đo phải bị chối");
}

#[test]
fn default_allows_contexts_not_touching_metered_token() {
    // Quản trị ví (context CallContract vào chính ví / contract khác) phải
    // CHO QUA — hạn mức quản tiền, không được khoá quyền quản trị rule 0.
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    install_default(&s, &client, &r);
    s.e.ledger().with_mut(|l| l.sequence_number = 1_000);

    let other = Address::generate(&s.e);
    client.enforce(
        &call_ctx(&s.e, &other, symbol_short!("add_rule"), None),
        &signers_of(&s),
        &r,
        &s.account,
    );
    // Cho qua nhưng KHÔNG cộng vào tổng chi.
    assert_eq!(
        client
            .get_spending_limit_data(&r.id, &s.account)
            .cached_total_spent,
        0
    );
}

#[test]
fn default_enforce_rejects_empty_signers() {
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    install_default(&s, &client, &r);
    let empty: Vec<Signer> = Vec::new(&s.e);
    let other = Address::generate(&s.e);
    let res = client.try_enforce(
        &call_ctx(&s.e, &other, symbol_short!("add_rule"), None),
        &empty,
        &r,
        &s.account,
    );
    assert!(res.is_err(), "không signer thật thì không được cho qua");
}

#[test]
fn default_uninstall_cleans_metered_token() {
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    install_default(&s, &client, &r);
    assert!(client.get_metered_token(&r.id, &s.account).is_some());
    client.uninstall(&r, &s.account);
    assert_eq!(client.get_metered_token(&r.id, &s.account), None);
}
