//! Test tích hợp v2: registry + smart-account + verifier ed25519 THẬT.
//!
//! Chứng minh đủ DONE-gate audit P0:
//!   - finalize XOAY KHOÁ BÊN TRONG smart account (đọc signer list TỪ account,
//!     không phải từ registry), địa chỉ ví không đổi.
//!   - Khoá MỚI ký được qua __check_auth thật (crypto thật, không mock);
//!     khoá CŨ bị chối.
//!   - Cooldown sau xoay: mọi chữ ký bị chối tới hết cửa sổ.
//!   - finalize chạy với ZERO auth entry (set_auths rỗng) — timelock on-chain gác,
//!     và invoker auth registry→account hoạt động thật.
#![cfg(test)]
extern crate std;

use ed25519_dalek::{Signer as DalekSigner, SigningKey};
use smart_account::{FamilyWalletAccount, FamilyWalletAccountClient};
use soroban_sdk::auth::{Context, ContractContext};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{map, symbol_short, vec, Address, Bytes, BytesN, Env, IntoVal, Val, Vec};
use stellar_accounts::smart_account::{AuthPayload, Signer, SmartAccountError};
use verifier_ed25519::Ed25519Verifier;

use crate::{RecoveryRegistry, RecoveryRegistryClient, RecoveryStatus, RegistryError};

const TIMELOCK: u64 = 3600;
const COOLDOWN: u64 = 86400;

struct World<'a> {
    registry: RecoveryRegistryClient<'a>,
    account: FamilyWalletAccountClient<'a>,
    account_addr: Address,
    verifier: Address,
    g1: Address,
    g2: Address,
    g3: Address,
    sk_old: SigningKey,
}

fn ext_signer(e: &Env, verifier: &Address, sk: &SigningKey) -> Signer {
    Signer::External(
        verifier.clone(),
        Bytes::from_array(e, sk.verifying_key().as_bytes()),
    )
}

/// Dựng thế giới: verifier + account (khoá cũ) + registry, đăng ký 3 guardian
/// threshold 2. Auth mock cho phần setup (ký passkey thật phủ ở test __check_auth).
fn setup(e: &Env) -> World<'_> {
    e.mock_all_auths();
    let verifier = e.register(Ed25519Verifier, ());
    let sk_old = SigningKey::from_bytes(&[1u8; 32]);
    let signers = vec![e, ext_signer(e, &verifier, &sk_old)];
    let policies: soroban_sdk::Map<Address, Val> = map![e];
    let account_addr = e.register(FamilyWalletAccount, (signers, policies));
    let account = FamilyWalletAccountClient::new(e, &account_addr);

    let registry_addr = e.register(RecoveryRegistry, ());
    let registry = RecoveryRegistryClient::new(e, &registry_addr);

    account.set_recovery_registry(&registry_addr, &COOLDOWN);

    let (g1, g2, g3) = (
        Address::generate(e),
        Address::generate(e),
        Address::generate(e),
    );
    registry.register_wallet(
        &account_addr,
        &vec![e, g1.clone(), g2.clone(), g3.clone()],
        &2,
        &TIMELOCK,
    );

    World {
        registry,
        account,
        account_addr,
        verifier,
        g1,
        g2,
        g3,
        sk_old,
    }
}

fn warp(e: &Env, secs: u64) {
    e.ledger().with_mut(|li| li.timestamp += secs);
}

/// Gọi __check_auth THẬT: dựng AuthPayload, ký auth_digest đúng công thức OZ
/// (sha256(payload ++ context_rule_ids.to_xdr())) bằng khoá đưa vào.
fn check_auth_with(
    e: &Env,
    account: &Address,
    verifier: &Address,
    sk: &SigningKey,
) -> Result<(), ()> {
    let payload = BytesN::from_array(e, &[7u8; 32]);
    let rule_ids: Vec<u32> = vec![e, 0u32];

    let mut preimage = Bytes::from_array(e, &[7u8; 32]);
    preimage.append(&rule_ids.clone().to_xdr(e));
    let digest = e.crypto().sha256(&preimage);
    let sig: [u8; 64] = sk.sign(&digest.to_array()).to_bytes();

    let auth_payload = AuthPayload {
        signers: map![e, (ext_signer(e, verifier, sk), Bytes::from_array(e, &sig))],
        context_rule_ids: rule_ids,
    };
    let contexts = vec![
        e,
        Context::Contract(ContractContext {
            contract: Address::generate(e),
            fn_name: symbol_short!("transfer"),
            args: vec![e],
        }),
    ];
    let sig_val: Val = auth_payload.into_val(e);
    e.try_invoke_contract_check_auth::<SmartAccountError>(account, &payload, sig_val, &contexts)
        .map_err(|_| ())
}

// ---------- Validation đăng ký / guardian ----------

#[test]
fn register_rejects_bad_inputs() {
    let e = Env::default();
    let w = setup(&e);
    let other = Address::generate(&e);
    // Đăng ký trùng
    assert_eq!(
        w.registry
            .try_register_wallet(&w.account_addr, &vec![&e, w.g1.clone()], &1, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::AlreadyRegistered.into()
    );
    // threshold 0 / vượt số guardian
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &vec![&e, w.g1.clone()], &0, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::InvalidThreshold.into()
    );
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &vec![&e, w.g1.clone()], &2, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::InvalidThreshold.into()
    );
    // guardian trùng nhau / guardian = chính ví
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &vec![&e, w.g1.clone(), w.g1.clone()], &1, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::DuplicateGuardian.into()
    );
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &vec![&e, other.clone()], &1, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::DuplicateGuardian.into()
    );
    // rỗng
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &Vec::new(&e), &1, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TooFewGuardians.into()
    );
}

#[test]
fn remove_guardian_lockout_blocked() {
    let e = Env::default();
    let w = setup(&e);
    // 3 guardian threshold 2: gỡ 1 → còn 2 ≥ 2, OK.
    w.registry.remove_guardian(&w.account_addr, &w.g3);
    // Gỡ tiếp → còn 1 < threshold 2 → CHẶN (chống lockout).
    assert_eq!(
        w.registry
            .try_remove_guardian(&w.account_addr, &w.g2)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::InvalidThreshold.into()
    );
    // Gỡ người không tồn tại
    assert_eq!(
        w.registry
            .try_remove_guardian(&w.account_addr, &Address::generate(&e))
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::GuardianNotFound.into()
    );
}

#[test]
fn guardian_config_frozen_during_recovery() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g1,
    );
    assert_eq!(
        w.registry
            .try_add_guardian(&w.account_addr, &Address::generate(&e))
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryInProgress.into()
    );
    assert_eq!(
        w.registry
            .try_remove_guardian(&w.account_addr, &w.g3)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryInProgress.into()
    );
}

// ---------- Vòng đời recovery ----------

#[test]
fn initiate_approve_flow_counts_votes() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    // Người ngoài không mở được
    assert_eq!(
        w.registry
            .try_initiate_recovery(&w.account_addr, &new_signer, &Address::generate(&e))
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::NotAGuardian.into()
    );

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    let st = w.registry.get_recovery_status(&w.account_addr);
    assert_eq!(st.approvals.len(), 1); // initiator = phiếu đầu — ĐỌC thật, không đoán
    assert_eq!(st.status, RecoveryStatus::Pending);

    // Mở chồng bị chặn
    assert_eq!(
        w.registry
            .try_initiate_recovery(&w.account_addr, &new_signer, &w.g2)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryInProgress.into()
    );
    // Phiếu trùng bị chặn
    assert_eq!(
        w.registry
            .try_approve_recovery(&w.account_addr, &w.g1)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::AlreadyApproved.into()
    );

    w.registry.approve_recovery(&w.account_addr, &w.g2);
    let st = w.registry.get_recovery_status(&w.account_addr);
    assert_eq!(st.approvals.len(), 2);
    assert_eq!(st.status, RecoveryStatus::Approved);
}

#[test]
fn veto_kills_recovery_and_approve_after_dies() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g1,
    );
    w.registry.cancel_recovery(&w.account_addr); // ví tự ký veto (mock ở setup)
    assert_eq!(
        w.registry
            .try_approve_recovery(&w.account_addr, &w.g2)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryCancelled.into()
    );
    warp(&e, TIMELOCK + 1);
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryCancelled.into()
    );
    // Sau veto: mở lại được vòng mới (request cũ đã chết)
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g2,
    );
}

#[test]
fn finalize_gated_by_threshold_and_timelock() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g1,
    );
    warp(&e, TIMELOCK + 1);
    // Đủ giờ nhưng thiếu phiếu (1/2)
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::ThresholdNotMet.into()
    );
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    // Đủ phiếu nhưng thử lùi giờ? Không lùi được — kiểm chiều thiếu giờ ở test riêng.
    w.registry.finalize_recovery(&w.account_addr);
}

#[test]
fn finalize_blocked_before_timelock() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g1,
    );
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    assert!(w.registry.timelock_remaining(&w.account_addr) > 0);
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TimelockNotElapsed.into()
    );
}

// ---------- TRÁI TIM AUDIT P0: xoay khoá thật + cooldown + ký thật ----------

#[test]
fn finalize_rotates_signer_inside_smart_account() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);
    let old_signer = ext_signer(&e, &w.verifier, &w.sk_old);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    warp(&e, TIMELOCK + 1);

    // ZERO auth entry: finalize không đòi auth người dùng (timelock gác) và
    // require_auth(registry) trong recovery_rotate thoả bằng INVOKER AUTH thật.
    e.set_auths(&[]);
    w.registry.finalize_recovery(&w.account_addr);

    // VERIFY TỪ SMART ACCOUNT (không phải registry): khoá cũ biến mất, khoá mới vào.
    let rule = w.account.get_context_rule(&0);
    assert_eq!(rule.signers.len(), 1);
    assert_eq!(rule.signers.get_unchecked(0), new_signer);
    assert!(!rule.signers.contains(&old_signer));
    // Địa chỉ ví KHÔNG đổi, mốc cooldown đã đóng dấu.
    assert_eq!(w.account.last_rotation(), Some(e.ledger().timestamp()));
    // Registry ghi Finalized.
    let st = w.registry.get_recovery_status(&w.account_addr);
    assert_eq!(st.status, RecoveryStatus::Finalized);

    // Finalize lần 2 chết đúng mã.
    e.mock_all_auths();
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::AlreadyFinalized.into()
    );
}

#[test]
fn new_key_signs_old_key_rejected_after_cooldown() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    // Trước khôi phục: khoá CŨ ký được thật qua __check_auth (crypto thật).
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_ok());

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    warp(&e, TIMELOCK + 1);
    e.set_auths(&[]);
    w.registry.finalize_recovery(&w.account_addr);

    // TRONG cooldown: MỌI chữ ký bị chối — kể cả khoá mới (chống xoay-rồi-rút-ngay).
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &sk_new).is_err());
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_err());

    // HẾT cooldown: khoá MỚI ký được, khoá CŨ bị chối.
    warp(&e, COOLDOWN + 1);
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &sk_new).is_ok());
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_err());
}

#[test]
fn rotate_requires_registry_not_configured_dies() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = e.register(Ed25519Verifier, ());
    let sk = SigningKey::from_bytes(&[1u8; 32]);
    let signers = vec![&e, ext_signer(&e, &verifier, &sk)];
    let policies: soroban_sdk::Map<Address, Val> = map![&e];
    let account_addr = e.register(FamilyWalletAccount, (signers, policies));
    let account = FamilyWalletAccountClient::new(&e, &account_addr);
    // Chưa set_recovery_registry → mã 100 (RecoveryNotConfigured).
    let err = account
        .try_recovery_rotate(&ext_signer(&e, &verifier, &sk))
        .err()
        .unwrap();
    assert_eq!(
        err,
        Ok(smart_account::FamilyWalletError::RecoveryNotConfigured.into())
    );
}
