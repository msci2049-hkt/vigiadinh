//! Test vỏ contract (logic đo đếm đã có test upstream trong OZ 0.7.2 —
//! ở đây chỉ chứng minh vỏ nối đúng: install qua client, enforce cộng dồn,
//! vượt hạn mức chết đúng mã 3221, rule Default bị chối lúc install (3227).
#![cfg(test)]

use soroban_sdk::{
    auth::{Context, ContractContext},
    symbol_short,
    testutils::{Address as _, Ledger},
    Address, Env, IntoVal, String, Vec,
};
use stellar_accounts::{
    policies::spending_limit::SpendingLimitAccountParams,
    smart_account::{ContextRule, ContextRuleType, Signer},
};

use crate::{SpendingLimitPolicy, SpendingLimitPolicyClient};

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

fn transfer_ctx(e: &Env, sac: &Address, amount: i128) -> Context {
    let from = Address::generate(e);
    let to = Address::generate(e);
    let mut args = Vec::new(e);
    args.push_back(from.into_val(e));
    args.push_back(to.into_val(e));
    args.push_back(amount.into_val(e));
    Context::Contract(ContractContext {
        contract: sac.clone(),
        fn_name: symbol_short!("transfer"),
        args,
    })
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

#[test]
fn install_then_enforce_within_limit_and_cumulative_block() {
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(
        &s.e,
        ContextRuleType::CallContract(s.sac.clone()),
        &s.signer,
    );
    let params = SpendingLimitAccountParams {
        spending_limit: 500,
        period_ledgers: 100,
    };

    client.install(&params, &r, &s.account);
    let data = client.get_spending_limit_data(&r.id, &s.account);
    assert_eq!(data.spending_limit, 500);
    assert_eq!(data.cached_total_spent, 0);

    // Ledger 0 làm cutoff `seq <= current - period` (saturating) evict ngay
    // entry vừa ghi — đặt mốc > period cho giống ledger thật.
    s.e.ledger().with_mut(|l| l.sequence_number = 1_000);

    // 100 + 300 = 400 ≤ 500 → qua; tổng được cộng dồn.
    let mut signers = Vec::new(&s.e);
    signers.push_back(Signer::Delegated(s.signer.clone()));
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
fn install_on_default_rule_rejected() {
    // Ràng buộc OZ (3227): KHÔNG gắn được vào rule Default — lý do LÔ 3 phải
    // add_context_rule CallContract(SAC) thay vì add_policy vào rule 0.
    let s = setup();
    let client = SpendingLimitPolicyClient::new(&s.e, &s.client_addr);
    let r = rule(&s.e, ContextRuleType::Default, &s.signer);
    let params = SpendingLimitAccountParams {
        spending_limit: 500,
        period_ledgers: 100,
    };
    let res = client.try_install(&params, &r, &s.account);
    assert!(
        res.is_err(),
        "install lên rule Default phải bị chối (OnlyCallContractAllowed)"
    );
}
