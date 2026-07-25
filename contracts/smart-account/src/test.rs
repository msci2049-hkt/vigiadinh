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
    testutils::{storage::Persistent as _, Address as _, Ledger as _},
    vec, Address, Bytes, BytesN, Env, IntoVal, Map, Val, Vec,
};
use stellar_accounts::smart_account::{Signer, SmartAccountStorageKey};

use crate::{
    FamilyWalletAccount, FamilyWalletAccountClient, FamilyWalletError, FwConstructorEntry,
};
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

/// MUTANTS closeout 2026-07-25 — biên `apply_pending`.
/// Giết `registry_link.rs:136:31` (`<`→`<=`): test cũ chỉ soi "sớm một giây thì
/// chối", không ai soi "ĐÚNG hạn thì cho". Đổi sang `<=` là đơn đổi registry đứng
/// treo thêm một giây và không có cửa nào giải thích tại sao.
#[test]
fn registry_change_applies_exactly_at_the_due_second() {
    let e = Env::default();
    e.mock_all_auths();
    let (account, _) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);
    let new_registry = Address::generate(&e);

    client.propose_recovery_registry(&new_registry, &1u64);
    let apply_at = client
        .pending_recovery_registry()
        .expect("đơn phải đang chờ")
        .apply_at;

    // ĐÚNG mốc `apply_at` — `timestamp < apply_at` là false → cho áp.
    e.ledger().set_timestamp(apply_at);
    client.apply_recovery_registry();

    assert_eq!(client.get_recovery_registry(), Some((new_registry, 1u64)));
    assert!(client.pending_recovery_registry().is_none());
}

/// MUTANTS closeout — biên TRẦN cooldown.
/// Giết `registry_link.rs:96:22` (`>`→`>=`): hai test cũ chỉ chứng minh "vượt trần
/// thì chối" (dùng `u64::MAX`), nên chối luôn ĐÚNG trần cũng không ai thấy. Trần là
/// 7 ngày và 7 ngày là lựa chọn hợp lệ — chối nó là chặn oan cấu hình an toàn nhất.
#[test]
fn cooldown_exactly_at_the_cap_is_accepted() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let registry = Address::generate(&e);
    let cap = crate::registry_link::MAX_COOLDOWN_SECS;

    // Qua constructor: ĐÚNG trần phải cắm được.
    let policies: Map<Address, Val> = map![
        &e,
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(cap).into_val(&e)
        )
    ];
    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);
    assert_eq!(client.get_recovery_registry(), Some((registry, cap)));

    // Và vượt trần MỘT giây thì vẫn chối — nhưng chối MUỘN, ở `apply`, không ở
    // `propose`. Ghi lại đúng như thế thay vì mong nó chối sớm:
    //
    // `propose` chỉ ghi đơn chờ, KHÔNG gọi `store` nên không qua kiểm trần; chỉ
    // `apply_pending` mới gọi `store`. Quả bom cooldown vẫn KHÔNG hạ cánh được
    // (store fail-closed), nên đây không phải lỗ bảo mật — nhưng nó là bẫy dùng:
    // người dùng chờ đủ 7 ngày mới biết đơn không áp được, và trong lúc đó
    // `RegistryChangePending` chặn mọi đơn mới. Phải `cancel` mới thoát.
    // Ghi vào BLOCKERS là phát hiện nhỏ "kiểm trần cooldown fail-late ở propose".
    let (account2, _) = wallet_with_registry(&e);
    let client2 = FamilyWalletAccountClient::new(&e, &account2);
    client2.propose_recovery_registry(&Address::generate(&e), &(cap + 1));
    warp(&e, crate::registry_link::REGISTRY_CHANGE_DELAY_SECS);
    assert_eq!(
        client2
            .try_apply_recovery_registry()
            .err()
            .unwrap()
            .unwrap(),
        FamilyWalletError::CooldownTooLong.into(),
        "vượt trần phải chết ở apply — store là cửa duy nhất ghi cooldown"
    );
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

// ---------- Hồi quy audit 2026-07-25 ----------

/// P0-4: `cooldown_secs` không có trần là quả bom hẹn giờ. Ví chạy bình thường,
/// người dùng nạp tiền; tới khi cả nhà khôi phục thật thì `__check_auth` tính
/// `last_rotation + cooldown` và từ đó CHỐI MỌI chữ ký — kể cả khoá vừa khôi
/// phục. Không có đường thoát: mọi cửa sửa lại đều đòi chữ ký của chính ví vừa
/// bị khoá. Trần chặn ngay từ lúc cắm, ở cả hai cửa vào.
#[test]
#[should_panic(expected = "Error(Contract, #108)")]
fn constructor_rejects_unbounded_cooldown() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            Address::generate(&e),
            FwConstructorEntry::RecoveryRegistry(u64::MAX).into_val(&e)
        )
    ];
    let _ = e.register(FamilyWalletAccount, (signers, policies));
}

#[test]
#[should_panic(expected = "Error(Contract, #108)")]
fn set_recovery_registry_rejects_unbounded_cooldown() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier, pubkey)];
    let policies: Map<Address, Val> = map![&e];
    let addr = e.register(FamilyWalletAccount, (signers, policies));
    FamilyWalletAccountClient::new(&e, &addr)
        .set_recovery_registry(&Address::generate(&e), &u64::MAX);
}

// ---------- Hồi quy audit 2026-07-25 (đợt 2, closeout) ----------

/// B-SEC-1: `recovery_rotate` ở ví ĐÃ NỐI ĐỦ 15 thiết bị — đúng trần `MAX_SIGNERS`
/// của OZ. Bản thêm-trước-xoá cũ gọi `add_signer` khi rule đã có 15 signer →
/// `validate_signers_and_policies` panic `TooManySigners` → cả tx revert → đơn khôi
/// phục kẹt `Approved` vĩnh viễn, ví KHÔNG BAO GIỜ cứu được. Đây là kịch bản
/// "mất ví", tệ hơn "mất tiền". Bản xoay-neo-nguyên-tử phải xoay xong còn ĐÚNG một
/// signer: khoá mới. Test này ĐỎ trên bản thêm-trước-xoá (panic #... TooManySigners).
#[test]
fn recovery_rotate_survives_a_wallet_full_of_15_signers() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let registry = Address::generate(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier.clone(), pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(86400u64).into_val(&e)
        )
    ];
    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);

    // Nối thêm 14 vỏ (mỗi vỏ một khoá khác nhau) → chạm đúng trần 15 signer.
    for i in 5u8..19u8 {
        let extra = vec![
            &e,
            Signer::External(verifier.clone(), Bytes::from_array(&e, &[i; 65])),
        ];
        client.batch_add_signer(&0, &extra);
    }
    assert_eq!(client.get_context_rule(&0).signers.len(), 15);

    // Xoay khoá khôi phục: bản cũ chết ở add_signer thứ 16. Bản neo sống.
    let new_signer = Signer::External(verifier, Bytes::from_array(&e, &[99u8; 65]));
    client.recovery_rotate(&new_signer);

    let rule = client.get_context_rule(&0);
    assert_eq!(rule.signers.len(), 1);
    // Và đúng là khoá MỚI — mọi khoá cũ (kể cả neo) đã biến mất.
    assert_eq!(rule.signers.get(0), Some(new_signer));
}

/// B-SEC-1 phụ: rotate ở ví đang có RecoveryRequest mở vẫn xoay đúng (không kẹt
/// trạng thái trung gian rỗng-signer giữa remove và add).
#[test]
fn recovery_rotate_leaves_exactly_the_new_key_on_a_normal_wallet() {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = register_verifier(&e);
    let registry = Address::generate(&e);
    let pubkey = Bytes::from_array(&e, &[4u8; 65]);
    let signers = vec![&e, Signer::External(verifier.clone(), pubkey)];
    let policies: Map<Address, Val> = map![
        &e,
        (
            registry.clone(),
            FwConstructorEntry::RecoveryRegistry(86400u64).into_val(&e)
        )
    ];
    let account = e.register(FamilyWalletAccount, (signers, policies));
    let client = FamilyWalletAccountClient::new(&e, &account);
    // Ví 3 signer (1 gốc + 2 vỏ) — đường "gỡ hết trừ neo" chạy nhiều vòng.
    for i in 5u8..7u8 {
        let extra = vec![
            &e,
            Signer::External(verifier.clone(), Bytes::from_array(&e, &[i; 65])),
        ];
        client.batch_add_signer(&0, &extra);
    }
    assert_eq!(client.get_context_rule(&0).signers.len(), 3);

    let new_signer = Signer::External(verifier, Bytes::from_array(&e, &[42u8; 65]));
    client.recovery_rotate(&new_signer);
    let rule = client.get_context_rule(&0);
    assert_eq!(rule.signers.len(), 1);
    assert_eq!(rule.signers.get(0), Some(new_signer));
}

/// B-SEC-2: `extend_ttl` phải gia hạn `SignerData` (khoá passkey thật của OZ),
/// không chỉ `ContextRuleData`. OZ tách khoá ra entry persistent RIÊNG, chỉ gia hạn
/// KHI CÓ NGƯỜI ĐỌC RULE (`__check_auth`). Ví thừa kế nằm im = không ai đọc =
/// `SignerData` archive dù cron gia hạn `ContextRuleData` đều đặn → chữ ký chết.
///
/// Ép gia hạn: Soroban `extend_ttl(threshold, extend_to)` chỉ nhảy khi remaining <
/// threshold. OZ đã cộng sẵn 30 ngày (~518_400 ledger) khi đọc, nên phải đặt
/// threshold = extend_to = 700_000 (> 518_400) để lệnh gia hạn TƯỜNG MINH của ta
/// thực sự chạy, rồi so live_until của `SignerData` với `ContextRuleData` — phải
/// BẰNG NHAU. Bản cũ không đọc/không chạm signer nên `SignerData` giữ mốc OZ
/// (518_400, thấp hơn 700_000) → assert_eq ĐỎ (chứng minh test bắt được lỗi).
#[test]
fn extend_ttl_reaches_the_owner_passkey_signer_entry() {
    let e = Env::default();
    let (account, _) = wallet_with_registry(&e);
    let client = FamilyWalletAccountClient::new(&e, &account);

    // threshold == extend_to buộc lệnh gia hạn chạy dù OZ đã cộng sẵn 518_400.
    let extend_to = 700_000u32;
    client.extend_ttl(&extend_to, &extend_to);

    let owner_rule = client.get_context_rule(&0);
    let signer_id = owner_rule
        .signer_ids
        .get(0)
        .expect("owner rule has a signer");

    let (rule_ttl, signer_ttl) = e.as_contract(&account, || {
        (
            e.storage()
                .persistent()
                .get_ttl(&SmartAccountStorageKey::ContextRuleData(0)),
            e.storage()
                .persistent()
                .get_ttl(&SmartAccountStorageKey::SignerData(signer_id)),
        )
    });
    // Cả hai được gia hạn tới cùng mốc extend_to → SignerData không còn bị bỏ lại.
    assert_eq!(
        signer_ttl, rule_ttl,
        "SignerData phải gia hạn NGANG ContextRuleData; lệch = passkey vẫn archive sớm"
    );
    assert!(
        signer_ttl >= extend_to - 1,
        "SignerData live_until phải đạt mốc extend_to tường minh"
    );
}
