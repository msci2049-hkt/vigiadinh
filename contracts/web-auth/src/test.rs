//! Test contract SEP-45: require_auth đúng các address trong args, thiếu args bắt buộc
//! là chết có mã lỗi, args thừa bị bỏ qua đúng spec, và KHÔNG có auth thì không qua.
#![cfg(test)]
extern crate std;

use soroban_sdk::testutils::Address as _;
use soroban_sdk::{map, Address, Env, Map, String, Symbol};

use crate::{WebAuthContract, WebAuthContractClient, WebAuthError};

fn setup(e: &Env) -> (WebAuthContractClient<'_>, Address, Address) {
    let contract_id = e.register(WebAuthContract, ());
    let client = WebAuthContractClient::new(e, &contract_id);
    (client, Address::generate(e), Address::generate(e))
}

fn base_args(e: &Env, account: &Address, server: &Address) -> Map<Symbol, String> {
    map![
        e,
        (Symbol::new(e, "account"), account.to_string()),
        (
            Symbol::new(e, "web_auth_domain_account"),
            server.to_string()
        ),
        (
            Symbol::new(e, "home_domain"),
            String::from_str(e, "vigiadinh.com")
        ),
        (
            Symbol::new(e, "web_auth_domain"),
            String::from_str(e, "api.vigiadinh.com")
        ),
        (
            Symbol::new(e, "nonce"),
            String::from_str(e, "d2d7c47e0f2d4c1e")
        ),
    ]
}

/// Happy path: require_auth được gọi cho ĐÚNG account + server account.
#[test]
fn requires_auth_from_account_and_server() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, account, server) = setup(&e);

    client.web_auth_verify(&base_args(&e, &account, &server));

    let authed: std::vec::Vec<Address> = e.auths().into_iter().map(|(addr, _)| addr).collect();
    assert!(authed.contains(&account), "thiếu require_auth(account)");
    assert!(authed.contains(&server), "thiếu require_auth(server)");
    assert_eq!(authed.len(), 2);
}

/// Có client_domain_account → require_auth THÊM địa chỉ đó (3 auth).
#[test]
fn requires_auth_from_client_domain_when_present() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, account, server) = setup(&e);
    let client_domain = Address::generate(&e);

    let mut args = base_args(&e, &account, &server);
    args.set(
        Symbol::new(&e, "client_domain_account"),
        client_domain.to_string(),
    );
    args.set(
        Symbol::new(&e, "client_domain"),
        String::from_str(&e, "wallet.example.com"),
    );
    client.web_auth_verify(&args);

    let authed: std::vec::Vec<Address> = e.auths().into_iter().map(|(addr, _)| addr).collect();
    assert!(authed.contains(&client_domain));
    assert_eq!(authed.len(), 3);
}

/// Thiếu `account` → Error #1, không require_auth ai cả.
#[test]
fn missing_account_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _account, server) = setup(&e);

    let args: Map<Symbol, String> = map![
        &e,
        (
            Symbol::new(&e, "web_auth_domain_account"),
            server.to_string()
        ),
    ];
    let result = client.try_web_auth_verify(&args);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            WebAuthError::MissingAccount as u32
        )))
    );
}

/// Thiếu `web_auth_domain_account` → Error #2.
#[test]
fn missing_server_account_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, account, _server) = setup(&e);

    let args: Map<Symbol, String> = map![&e, (Symbol::new(&e, "account"), account.to_string())];
    let result = client.try_web_auth_verify(&args);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            WebAuthError::MissingServerAccount as u32
        )))
    );
}

/// Không mock auth → require_auth thật → chết (chứng minh auth KHÔNG bị bỏ qua).
#[test]
#[should_panic]
fn unauthorized_call_panics() {
    let e = Env::default();
    let (client, account, server) = setup(&e);
    client.web_auth_verify(&base_args(&e, &account, &server));
}
