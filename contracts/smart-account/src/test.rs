//! Test account — wire OZ smart account với origin-verifier THẬT làm External signer.
//! Chứng minh: ví dựng bằng WASM hash + constructor args (không hard-code contract ID),
//! signer passkey đăng ký được, context rule mặc định tạo đúng.
//! (Luồng __check_auth crypto đầy đủ đã phủ ở origin-verifier tests — verify() account
//! gọi CHÍNH là verify() đã test ở đó.)
#![cfg(test)]
extern crate std;

use sha2::{Digest, Sha256};
use soroban_sdk::{
    map,
    testutils::{Address as _, Ledger as _},
    vec, Address, Bytes, BytesN, Env, IntoVal, Map, Val, Vec,
};
use stellar_accounts::smart_account::Signer;

use crate::{FamilyWalletAccount, FamilyWalletAccountClient, FwConstructorEntry};
use origin_verifier::{OriginWebauthnVerifier, OriginWebauthnVerifierClient};

const RP_ID: &str = "vigiadinh.com";
const ORIGIN_WEB: &str = "https://vigiadinh.com";
const ORIGIN_APK: &str = "android:apk-key-hash:TEST";
const ORIGIN_EXT: &str = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

fn register_verifier(e: &Env) -> Address {
    let rp_hash: [u8; 32] = Sha256::digest(RP_ID.as_bytes()).into();
    let origins: Vec<Bytes> = vec![
        e,
        Bytes::from_slice(e, ORIGIN_WEB.as_bytes()),
        Bytes::from_slice(e, ORIGIN_APK.as_bytes()),
        Bytes::from_slice(e, ORIGIN_EXT.as_bytes()),
    ];
    e.register(
        OriginWebauthnVerifier,
        (BytesN::from_array(e, &rp_hash), origins),
    )
}

/// Ví mở bằng constructor args (signer passkey), không contract ID cố định.
#[test]
fn create_wallet_with_passkey_signer() {
    let e = Env::default();
    let verifier = register_verifier(&e);
    // key_data = 65-byte pubkey giả (đủ dài để OZ validate_signer_key_size chấp nhận).
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier.clone(), pubkey)];
    let policies: Map<Address, Val> = map![&e];

    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);

    // Context rule mặc định (id 0) tồn tại với đúng 1 signer.
    assert_eq!(client.get_context_rules_count(), 1);
    let rule = client.get_context_rule(&0);
    assert_eq!(rule.signers.len(), 1);
}

/// Verifier deploy độc lập, nhiều ví cùng trỏ tới (một verifier — nhiều account).
#[test]
fn verifier_shared_config_readable() {
    let e = Env::default();
    let verifier = register_verifier(&e);
    let vc = OriginWebauthnVerifierClient::new(&e, &verifier);
    let (rp, origins) = vc.config();
    let expected: [u8; 32] = Sha256::digest(RP_ID.as_bytes()).into();
    assert_eq!(rp, BytesN::from_array(&e, &expected));
    assert_eq!(origins.len(), 3);
}

/// P0: registry khôi phục cắm NGAY trong tx deploy qua mục đặt chỗ trong map
/// `policies` — không cần tx thứ hai (tx đó fail = ví vĩnh viễn không cứu được).
#[test]
fn constructor_links_recovery_registry_atomically() {
    let e = Env::default();
    let verifier = register_verifier(&e);
    let registry = Address::generate(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(3600u64).into_val(&e)
        )
    ];

    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);

    assert_eq!(client.get_recovery_registry(), Some((registry, 3600u64)));
    // Mục đặt chỗ ĐÃ được gỡ: nếu lọt sang OZ, add_context_rule gọi install()
    // lên registry và deploy chết ngay ở trên.
    let rule = client.get_context_rule(&0);
    assert_eq!(rule.policies.len(), 0);
    // CỔNG CHỐNG HỒI QUY: ví chủ luôn ĐÚNG MỘT signer — guardian không bao giờ
    // là signer ở đây (họ bỏ phiếu ở registry, xem RESEARCH-LOG §GUARDIAN-ID).
    assert_eq!(rule.signers.len(), 1);
}

/// Không chở mục đặt chỗ → không có registry (ví cũ vẫn deploy được như trước).
#[test]
fn constructor_without_entry_leaves_registry_unset() {
    let e = Env::default();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![&e];

    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);
    assert_eq!(client.get_recovery_registry(), None);
}

/// Bộ phân biệt phải CHÍNH XÁC: install-params của policy thật (map symbol,
/// vd `{threshold: 2}` của OZ SimpleThreshold) KHÔNG được nuốt nhầm thành mục
/// registry — nuốt nhầm = policy biến mất im lặng khỏi ví.
/// Test thẳng hàm tách để khỏi cần deploy contract policy thật.
#[test]
fn split_keeps_real_policy_params() {
    let e = Env::default();
    let registry = Address::generate(&e);
    let policy = Address::generate(&e);
    let threshold_params: Val =
        map![&e, (soroban_sdk::symbol_short!("threshold"), 2u32)].into_val(&e);

    let input: Map<Address, Val> = map![
        &e,
        (policy.clone(), threshold_params),
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(900u64).into_val(&e)
        )
    ];

    let (link, rest) = crate::registry_link::split_recovery_entry(&e, &input);
    assert_eq!(link, Some((registry, 900u64)));
    assert_eq!(rest.len(), 1);
    assert!(rest.contains_key(policy));
}

/// Hai mục registry trong một map = cấu hình mập mờ → chối thẳng (mã 102).
#[test]
#[should_panic(expected = "Error(Contract, #102)")]
fn constructor_rejects_two_recovery_entries() {
    let e = Env::default();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            Address::generate(&e),
            FwConstructorEntry::RecoveryRegistry(1u64).into_val(&e)
        ),
        (
            Address::generate(&e),
            FwConstructorEntry::RecoveryRegistry(2u64).into_val(&e)
        )
    ];
    let _ = e.register(FamilyWalletAccount, (signers, policies));
}

/// Ví ĐÃ có registry (cắm ở constructor) không cho set đè bằng cửa tự-ký —
/// đổi registry phải đi đường timelock, nếu không passkey bị chiếm là cắt được
/// người thân khỏi ví.
#[test]
#[should_panic(expected = "Error(Contract, #103)")]
fn set_recovery_registry_rejects_overwrite() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            Address::generate(&e),
            FwConstructorEntry::RecoveryRegistry(60u64).into_val(&e)
        )
    ];
    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);
    client.set_recovery_registry(&Address::generate(&e), &60u64);
}

/// Dựng ví đã cắm sẵn registry, trả (account, registry).
fn wallet_with_registry(e: &Env) -> (Address, Address) {
    let verifier = register_verifier(e);
    let registry = Address::generate(e);
    let pubkey = Bytes::from_array(e, &[4u8; 65]);
    let signers = vec![e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![
        e,
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(86400u64).into_val(e)
        )
    ];
    (
        e.register(FamilyWalletAccount, (signers, policies)),
        registry,
    )
}

fn warp(e: &Env, secs: u64) {
    let t = e.ledger().timestamp();
    e.ledger().set_timestamp(t + secs);
}

/// Đổi registry KHÔNG có hiệu lực ngay — phải chờ hết timelock.
#[test]
fn registry_change_waits_for_timelock() {
    let e = Env::default();
    e.mock_all_auths();
    let (account, old_registry) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);
    let new_registry = Address::generate(&e);

    client.propose_recovery_registry(&new_registry, &1000u64);
    // Chưa đổi gì cả — registry cũ vẫn là người duy nhất xoay được khoá.
    assert_eq!(
        client.get_recovery_registry(),
        Some((old_registry, 86400u64))
    );
    assert!(client.pending_recovery_registry().is_some());

    warp(&e, crate::registry_link::REGISTRY_CHANGE_DELAY_SECS + 1);
    client.apply_recovery_registry();
    assert_eq!(
        client.get_recovery_registry(),
        Some((new_registry, 1000u64))
    );
    assert!(client.pending_recovery_registry().is_none());
}

/// Áp sớm một giây cũng chết (mã 105) — timelock là mốc cứng, không "gần đủ".
#[test]
#[should_panic(expected = "Error(Contract, #105)")]
fn registry_change_rejects_early_apply() {
    let e = Env::default();
    e.mock_all_auths();
    let (account, _) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);
    client.propose_recovery_registry(&Address::generate(&e), &1u64);
    warp(&e, crate::registry_link::REGISTRY_CHANGE_DELAY_SECS - 1);
    client.apply_recovery_registry();
}

/// VETO: registry hiện tại huỷ được đơn đổi (đây là đường người thân chặn —
/// registry là nơi biết ai là guardian, ví thì không).
#[test]
fn current_registry_can_veto_change() {
    let e = Env::default();
    e.mock_all_auths();
    let (account, old_registry) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);

    client.propose_recovery_registry(&Address::generate(&e), &1u64);
    client.cancel_recovery_registry_change(&old_registry);

    assert!(client.pending_recovery_registry().is_none());
    warp(&e, crate::registry_link::REGISTRY_CHANGE_DELAY_SECS + 1);
    // Không còn đơn nào để áp → 104.
    assert_eq!(
        client.try_apply_recovery_registry().unwrap_err().unwrap(),
        crate::FamilyWalletError::NoPendingRegistryChange.into()
    );
}

/// Người ngoài (không phải ví, không phải registry) không huỷ được — nếu không
/// bất kỳ ai cũng chặn được chủ ví đổi registry mãi mãi.
#[test]
#[should_panic(expected = "Error(Contract, #107)")]
fn stranger_cannot_cancel_change() {
    let e = Env::default();
    e.mock_all_auths();
    let (account, _) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);
    client.propose_recovery_registry(&Address::generate(&e), &1u64);
    client.cancel_recovery_registry_change(&Address::generate(&e));
}

/// Thêm signer (nối vỏ mới) cần chính tài khoản ký — mock auth để test API.
#[test]
fn add_signer_grows_rule() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier.clone(), pubkey)];
    let policies: Map<Address, Val> = map![&e];
    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);

    let new_pubkey = Bytes::from_array(&e, &[5u8; 65]);
    let new_signers = vec![&e, Signer::External(verifier.clone(), new_pubkey)];
    client.batch_add_signer(&0, &new_signers);

    let rule = client.get_context_rule(&0);
    assert_eq!(rule.signers.len(), 2);
}

/// VECTOR GHIM CHÉO Rust↔TS cho mục đặt chỗ constructor. FE dựng ScVal này bằng
/// tay (`fe/apps/web/src/features/wallet/lib/recovery-link.ts`) vì kit không có
/// binding cho contract của ta. Đổi công thức một bên → HAI test cùng đỏ.
/// Cặp song sinh: `recovery-link.test.ts` §"vector ghim chéo Rust↔TS".
#[test]
fn recovery_entry_xdr_vector_matches_ts() {
    use soroban_sdk::xdr::ToXdr;
    let e = Env::default();
    let entry: Val = FwConstructorEntry::RecoveryRegistry(86400u64).into_val(&e);
    let bytes = entry.to_xdr(&e);
    let mut out = std::vec::Vec::new();
    for b in bytes.iter() {
        out.push(b);
    }
    assert_eq!(
        base64_encode(&out),
        "AAAAEAAAAAEAAAACAAAADwAAABBSZWNvdmVyeVJlZ2lzdHJ5AAAABQAAAAAAAVGA"
    );
}

fn base64_encode(input: &[u8]) -> std::string::String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = std::string::String::new();
    for c in input.chunks(3) {
        let b = [c[0], *c.get(1).unwrap_or(&0), *c.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        s.push(if c.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    s
}

/// TTL: `extend_ttl` chạy được và không đòi auth (cron ví phí gọi hộ ví nằm im).
/// Ví thừa kế nằm im nhiều tháng mà không ai gia hạn = entry archive = tiền còn
/// đó nhưng không mở được, đúng lúc gia đình cần nhất.
#[test]
fn extend_ttl_runs_without_auth() {
    let e = Env::default();
    let (account, _) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);
    // KHÔNG mock_all_auths: chứng minh không đòi chữ ký ai.
    client.extend_ttl(&100u32, &10_000u32);
    // Ví vẫn đọc được sau khi gia hạn (không phá state).
    assert_eq!(client.get_context_rule(&0).signers.len(), 1);
}
