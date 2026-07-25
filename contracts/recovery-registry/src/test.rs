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
use smart_account::{FamilyWalletAccount, FamilyWalletAccountClient, FamilyWalletError};
use soroban_sdk::auth::{Context, ContractContext};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{
    map, symbol_short, vec, Address, Bytes, BytesN, Env, IntoVal, InvokeError, Val, Vec,
};
use stellar_accounts::smart_account::{AuthPayload, Signer, SmartAccountError};
use verifier_ed25519::Ed25519Verifier;

use crate::{RecoveryRegistry, RecoveryRegistryClient, RecoveryStatus, RegistryError};

// Sàn on-chain sau audit 2026-07-25: MIN_TIMELOCK_SECS = 86_400. Test dùng
// đúng sàn — ngắn hơn là contract chối (#17), như thiết kế.
const TIMELOCK: u64 = 86_400;
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

/// Đặt timestamp TUYỆT ĐỐI. `warp` cộng dồn nên không đặt được chân đúng lên
/// biên `rot + cooldown`; test biên B-SEC-9 cần mốc chính xác, không xê dịch.
fn set_time(e: &Env, t: u64) {
    e.ledger().with_mut(|li| li.timestamp = t);
}

/// Như [`check_auth_with`] nhưng GIỮ mã lỗi thay vì nuốt thành `()`.
///
/// Cần thiết cho B-SEC-9: `is_err()` trần KHÔNG phân biệt "chối vì cooldown
/// (#101)" với "chối vì chữ ký sai khoá". Chính chỗ mù đó để mutant `<` → `<=`
/// trong `__check_auth` sống sót ở đợt mutants trước — cả hai nhánh vẫn "err",
/// chỉ khác lý do. Ký kiểu `FamilyWalletError` nên #101 về dạng `Err(Ok(..))`,
/// còn lỗi chữ ký của OZ không giải mã được sang enum này → `Err(Err(..))`.
fn check_auth_code(
    e: &Env,
    account: &Address,
    verifier: &Address,
    sk: &SigningKey,
) -> Result<(), Result<FamilyWalletError, InvokeError>> {
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
    e.try_invoke_contract_check_auth::<FamilyWalletError>(account, &payload, sig_val, &contexts)
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
    let trio = vec![&e, w.g1.clone(), w.g2.clone(), w.g3.clone()];
    // Đăng ký trùng
    assert_eq!(
        w.registry
            .try_register_wallet(&w.account_addr, &trio, &2, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::AlreadyRegistered.into()
    );
    // threshold 0 / dưới sàn 2 / vượt số guardian
    for bad in [0u32, 1u32, 4u32] {
        assert_eq!(
            w.registry
                .try_register_wallet(&other, &trio, &bad, &TIMELOCK)
                .err()
                .unwrap()
                .unwrap(),
            RegistryError::InvalidThreshold.into()
        );
    }
    // guardian trùng nhau / guardian = chính ví
    assert_eq!(
        w.registry
            .try_register_wallet(
                &other,
                &vec![&e, w.g1.clone(), w.g1.clone(), w.g2.clone()],
                &2,
                &TIMELOCK
            )
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::DuplicateGuardian.into()
    );
    assert_eq!(
        w.registry
            .try_register_wallet(
                &other,
                &vec![&e, other.clone(), w.g1.clone(), w.g2.clone()],
                &2,
                &TIMELOCK
            )
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::DuplicateGuardian.into()
    );
    // rỗng / dưới sàn MIN_GUARDIANS = 3
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &Vec::new(&e), &2, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TooFewGuardians.into()
    );
    assert_eq!(
        w.registry
            .try_register_wallet(&other, &vec![&e, w.g1.clone(), w.g2.clone()], &2, &TIMELOCK)
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

/// B-SEC-9 — BIÊN cooldown `#101`, đóng đinh ĐÚNG BA MỐC bằng mã lỗi.
///
/// Vì sao mục này còn mở sau đợt trước: cooldown là thứ DUY NHẤT chặn kịch bản #7
/// "xoay khoá rồi rút ngay", nhưng test cũ
/// (`new_key_signs_old_key_rejected_after_cooldown`) chỉ soi `COOLDOWN + 1` và chỉ
/// hỏi `is_err()`. Đổi `<` thành `<=` trong `__check_auth` KHÔNG làm nó đỏ — tại
/// `rot + COOLDOWN + 1` cả hai toán tử đều cho qua, và mốc "trong cooldown" thì cả
/// hai đều chặn. Đó là mutant sống ở `__check_auth` mà đợt trước ghi nhận.
///
/// NGỮ NGHĨA CHỐT (off-by-one ở đây = rút sớm = mất tiền, nên ghi ra thành lời):
/// cửa sổ là nửa mở `[rot, rot + cooldown)` — chối khi `timestamp < rot + cooldown`.
/// Tại ĐÚNG `rot + cooldown` là ĐÃ CHO ký: "nghỉ đủ `cooldown` giây" nghĩa là khi
/// giây thứ `cooldown` điểm thì kỳ nghỉ hết. Chọn nửa mở vì đó cũng là luật biên
/// của `apply_pending` (`timestamp < apply_at` mới chặn) và của
/// `finalize_recovery` — một quy ước biên cho cả contract, không hai kiểu.
#[test]
fn cooldown_boundary_is_exact_at_three_points() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[2u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    warp(&e, TIMELOCK + 1);
    e.set_auths(&[]);
    w.registry.finalize_recovery(&w.account_addr);

    // Mốc thật do contract đóng dấu, không phải mốc test tự đoán.
    let rot = w.account.last_rotation().expect("rotate phải đóng dấu mốc");

    // (1) rot + cooldown - 1 → CHẶN, và chặn ĐÚNG VÌ cooldown (#101), không phải
    //     vì chữ ký sai. Khoá mới là khoá hợp lệ duy nhất lúc này, nên nếu #101 mà
    //     không nổ thì chữ ký này lẽ ra qua được → mã lỗi là bằng chứng thật.
    set_time(&e, rot + COOLDOWN - 1);
    assert_eq!(
        check_auth_code(&e, &w.account_addr, &w.verifier, &sk_new),
        Err(Ok(FamilyWalletError::CooldownActive)),
        "1 giây trước biên phải chối bằng #101"
    );

    // (2) ĐÚNG biên rot + cooldown → CHO ký. Đây là mốc mutant `<`→`<=` chết:
    //     với `<=` thì mốc này còn chối và assert dưới đỏ.
    set_time(&e, rot + COOLDOWN);
    assert_eq!(
        check_auth_code(&e, &w.account_addr, &w.verifier, &sk_new),
        Ok(()),
        "đúng biên là hết nghỉ — cửa sổ nửa mở [rot, rot+cooldown)"
    );

    // (3) rot + cooldown + 1 → vẫn cho ký, và khoá CŨ vẫn chết hẳn (hết cooldown
    //     không hồi sinh thiết bị cũ — nếu không thì recovery vô nghĩa).
    set_time(&e, rot + COOLDOWN + 1);
    assert_eq!(
        check_auth_code(&e, &w.account_addr, &w.verifier, &sk_new),
        Ok(())
    );
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_err());

    // (4) Chặn phải là chặn TOÀN BỘ, không riêng khoá mới: trong cửa sổ, khoá cũ
    //     cũng phải trả #101 chứ không phải lỗi chữ ký — chứng minh cổng cooldown
    //     nằm TRƯỚC `do_check_auth`, không phải sau.
    set_time(&e, rot);
    assert_eq!(
        check_auth_code(&e, &w.account_addr, &w.verifier, &w.sk_old),
        Err(Ok(FamilyWalletError::CooldownActive)),
        "cổng cooldown phải chặn trước khi xét chữ ký"
    );
}

/// KỊCH BẢN ĐỎ #3 (closeout §6) — BACKEND CHẾT thì cửa nào còn mở?
///
/// Đợt trước ghi mục này là "caveat". Nó KHÔNG phải caveat, và test này chốt lý do
/// bằng hành vi contract, không bằng lời:
///
///   - `finalize_recovery` chạy được với ZERO auth entry (`set_auths(&[])`). Nghĩa
///     là sau timelock, BẤT KỲ AI cũng crank được — kể cả kẻ tấn công, tự nộp tx
///     lên RPC công cộng, KHÔNG cần backend của mình sống.
///   - `cancel_recovery` (veto) ĐÒI chữ ký của chính ví. Chủ ví có khoá đó, nhưng
///     trong sản phẩm hiện tại đường duy nhất để DỰNG và NỘP tx veto là hai lời gọi
///     backend (`POST /api/recovery/veto` build → `POST /api/recovery/submit`).
///
/// Cộng hai điều đó lại: backend sập là CHỈ phòng tuyến của người phòng thủ mất,
/// còn đường tấn công vẫn nguyên. Bất đối xứng đó là 🔴, không phải caveat —
/// "fail-closed" ở đây đóng cửa nhà mình chứ không đóng cửa kẻ trộm.
///
/// Điều test này CŨNG chứng minh: lỗ nằm ở CLIENT/hạ tầng, KHÔNG ở contract.
/// Contract không đòi khoá nào của backend cho veto — chỉ đòi khoá ví. Nên vá được
/// bằng đường nộp trực tiếp phía client, không cần đổi contract.
#[test]
fn veto_needs_the_owner_key_while_finalize_needs_nobody() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[8u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    warp(&e, TIMELOCK + 1);

    // (1) VETO không có chữ ký ví → CHẾT. Đây là điều tốt (không ai veto hộ), nhưng
    //     nó cũng là lý do backend sập thì chủ ví mất đường chặn trong sản phẩm.
    e.set_auths(&[]);
    assert!(
        w.registry.try_cancel_recovery(&w.account_addr).is_err(),
        "veto phải đòi chữ ký ví — không thì ai cũng huỷ recovery của người khác"
    );

    // (2) FINALIZE với ZERO auth entry → CHẠY. Kẻ tấn công không cần gì của mình.
    e.set_auths(&[]);
    w.registry.finalize_recovery(&w.account_addr);
    assert_eq!(
        w.registry.get_recovery_status(&w.account_addr).status,
        RecoveryStatus::Finalized,
        "finalize không đòi auth → đường tấn công KHÔNG phụ thuộc backend"
    );
}

/// §3.1 closeout — INSTANCE STORAGE của chính ví, sau nhiều tháng KHÔNG dùng.
///
/// Câu hỏi bị bỏ lửng hai đợt: OZ nói rõ nó quản TTL cho temporary + persistent
/// nhưng CỐ TÌNH KHÔNG quản `instance` — đó là việc của dev. Ví thừa kế nằm im hàng
/// năm rồi mới cần dùng là ca sử dụng CHÍNH, nên nếu instance archive mà không dậy
/// lại được thì ví chết vĩnh viễn — lỗ to hơn `SignerData`.
///
/// Ví của mình để 4 khoá trong `instance`: `RecoveryRegistry`, `OwnerRuleId`,
/// `LastRotation`, `PendingRegistry`. `__check_auth` đọc HAI khoá đầu tiên trên mọi
/// lần ký, nên nếu instance chết thì không ký được gì nữa.
///
/// KẾT LUẬN test này chốt: KHÔNG cần vá thêm, vì Protocol 23 tự phục hồi
/// (auto-restore) entry đã archive khi có ai đọc tới — và test env mô phỏng đúng
/// hành vi đó. Giá phải trả là tx đánh thức ví trả thêm rent/ghi entry, KHÔNG phải
/// mất dữ liệu. Đây là bằng chứng bằng test, không phải suy luận từ tài liệu.
#[test]
fn wallet_instance_storage_survives_months_of_disuse() {
    let e = Env::default();
    let w = setup(&e);

    // Ký được TRƯỚC khi nhảy thời gian — mốc so sánh.
    assert!(check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_ok());

    // Nhảy XA hơn mọi TTL: 6 tháng ledger (~5s/ledger) = 3_110_400, đúng con số
    // `TTL_EXTEND_TO` mà cron ví phí dùng, cộng thêm biên cho chắc chắn đã quá hạn.
    let far = e.ledger().sequence() + 3_110_400 + 100_000;
    e.ledger().with_mut(|li| li.sequence_number = far);

    // (1) `__check_auth` VẪN chạy — instance (OwnerRuleId + RecoveryRegistry) và
    //     persistent của OZ (SignerData) được auto-restore khi đọc tới.
    assert!(
        check_auth_with(&e, &w.account_addr, &w.verifier, &w.sk_old).is_ok(),
        "ví nằm im 6 tháng vẫn phải ký được — nếu đỏ ở đây thì instance CẦN vá TTL"
    );

    // (2) Và registry vẫn còn nối — đường khôi phục không bốc hơi cùng thời gian.
    assert_eq!(
        w.account.get_recovery_registry(),
        Some((w.registry.address.clone(), COOLDOWN))
    );

    // (3) Cron gia hạn vẫn gọi được sau khi ví đã ngủ đông (không đòi auth).
    w.registry.extend_ttl(&w.account_addr);
}

// ---------- MUTANTS closeout 2026-07-25: biên validate + view ----------
//
// Đợt mutants toàn workspace để 11 mutant sống trong crate này. Chúng sống vì test
// cũ chỉ soi ca SAI (vượt trần, dưới sàn) mà không soi ca ĐÚNG BIÊN — nên đổi `>`
// thành `>=` không ai thấy. Với ví gia đình, biên sai theo hướng chặt là hộ hợp lệ
// không đăng ký/không khôi phục được; theo hướng lỏng là kẻ tấn công lọt.

/// Biên trần/sàn `register_wallet` — nhận ĐÚNG giới hạn, chối ngoài giới hạn.
/// Giết: 227:28 (`>`→`==`/`>=`, trần guardian), 230:51 (`>`→`>=`, threshold nhất trí).
#[test]
fn register_accepts_the_exact_limits() {
    let e = Env::default();
    e.mock_all_auths();
    let registry_addr = e.register(RecoveryRegistry, ());
    let registry = RecoveryRegistryClient::new(&e, &registry_addr);

    let ten: Vec<Address> = {
        let mut v = Vec::new(&e);
        for _ in 0..crate::MAX_GUARDIANS {
            v.push_back(Address::generate(&e));
        }
        v
    };
    assert_eq!(ten.len(), 10);

    // (1) ĐÚNG trần 10 người bảo hộ → PHẢI nhận. Gia đình lớn là ca thật, không phải
    //     ca biên lý thuyết; chặn ở đúng 10 là chặn oan một hộ hợp lệ.
    let w_max = Address::generate(&e);
    registry.register_wallet(&w_max, &ten, &2, &TIMELOCK);
    assert!(registry.is_registered(&w_max));

    // (2) threshold == số guardian (nhất trí toàn bộ) → PHẢI nhận. Đây là cấu hình
    //     an toàn NHẤT mà người dùng có thể chọn; chối nó là ép họ chọn yếu hơn.
    let w_unan = Address::generate(&e);
    let trio = vec![
        &e,
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
    ];
    registry.register_wallet(&w_unan, &trio, &3, &TIMELOCK);
    assert_eq!(registry.get_wallet_config(&w_unan).threshold, 3);

    // (3) Vượt trần MỘT người → vẫn chối (giữ chặn trên, không nới cùng lúc).
    let mut eleven = ten.clone();
    eleven.push_back(Address::generate(&e));
    assert_eq!(
        registry
            .try_register_wallet(&Address::generate(&e), &eleven, &2, &TIMELOCK)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TooManyGuardians.into()
    );

    // (4) ĐÚNG sàn timelock → nhận; dưới sàn một giây → chối.
    let w_floor = Address::generate(&e);
    registry.register_wallet(&w_floor, &trio, &2, &crate::MIN_TIMELOCK_SECS);
    assert!(registry.is_registered(&w_floor));
    assert_eq!(
        registry
            .try_register_wallet(
                &Address::generate(&e),
                &trio,
                &2,
                &(crate::MIN_TIMELOCK_SECS - 1)
            )
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TimelockTooShort.into()
    );
}

/// `add_guardian` — ca DƯƠNG (thêm được thật) + biên trần.
/// Giết: 266:25 (`==`→`!=`: ví tự làm guardian), 272:32 (`>=`→`<`: trần).
#[test]
fn add_guardian_positive_path_and_cap_boundary() {
    let e = Env::default();
    let w = setup(&e);

    // (1) CA DƯƠNG — không có nó, mutant `==`→`!=` ở kiểm "guardian == ví" sống:
    //     nó làm MỌI lần thêm người bảo hộ bình thường bị chối, và không test nào
    //     từng thêm thành công nên không ai thấy.
    let g4 = Address::generate(&e);
    w.registry.add_guardian(&w.account_addr, &g4);
    assert_eq!(
        w.registry
            .get_wallet_config(&w.account_addr)
            .guardians
            .len(),
        4
    );

    // (2) Ví KHÔNG được tự làm người bảo hộ của mình (veto/approve thành vô nghĩa).
    assert_eq!(
        w.registry
            .try_add_guardian(&w.account_addr, &w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::DuplicateGuardian.into()
    );

    // (3) Thêm tới ĐÚNG trần thì vẫn được; người thứ 11 mới bị chối.
    while w
        .registry
        .get_wallet_config(&w.account_addr)
        .guardians
        .len()
        < crate::MAX_GUARDIANS
    {
        w.registry
            .add_guardian(&w.account_addr, &Address::generate(&e));
    }
    assert_eq!(
        w.registry
            .get_wallet_config(&w.account_addr)
            .guardians
            .len(),
        crate::MAX_GUARDIANS
    );
    assert_eq!(
        w.registry
            .try_add_guardian(&w.account_addr, &Address::generate(&e))
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TooManyGuardians.into()
    );
}

/// Biên `finalize_recovery` — hai mốc thời gian, hai mutant.
/// Giết: 391:20 (`<`→`<=`: timelock vừa đủ), 396:16 (`>`→`>=`: giây cuối hạn dùng),
/// và 84:35 (`*`→`+` trong `REQUEST_GRACE_SECS`) qua assert công thức `expires_at`.
#[test]
fn finalize_boundaries_are_exact() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[3u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    let req = w.registry.get_recovery_status(&w.account_addr);

    // Công thức hạn dùng là ĐỘC LẬP với hằng trong code: viết thẳng 7 ngày bằng số.
    // Mutant `7 * 86_400` → `7 + 86_400` làm hạn dùng tụt từ 7 ngày xuống ~1 ngày —
    // yêu cầu khôi phục hợp lệ sẽ chết non trong khi cả nhà còn đang chờ đủ phiếu.
    assert_eq!(
        req.expires_at,
        req.started_at + TIMELOCK + 7 * 86_400,
        "hạn dùng = started_at + timelock + 7 ngày"
    );

    // (1) MỘT GIÂY TRƯỚC khi hết timelock → vẫn chặn.
    set_time(&e, req.started_at + TIMELOCK - 1);
    e.set_auths(&[]);
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TimelockNotElapsed.into()
    );

    // (2) ĐÚNG mốc hết timelock → CHO finalize. Mutant `<`→`<=` chết ở đây: nó bắt
    //     cả nhà chờ thêm một giây nữa mà không lý do nào giải thích được.
    set_time(&e, req.started_at + TIMELOCK);
    w.registry.finalize_recovery(&w.account_addr);
    assert_eq!(
        w.registry.get_recovery_status(&w.account_addr).status,
        RecoveryStatus::Finalized
    );
}

/// Giây CUỐI của hạn dùng vẫn finalize được — hạn dùng là `[started, expires]` đóng.
/// Giết: 396:16 (`>`→`>=`). Tách khỏi test trên vì mỗi ví chỉ finalize được một lần.
#[test]
fn finalize_on_the_last_second_of_the_grace_window_still_works() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[4u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    let req = w.registry.get_recovery_status(&w.account_addr);

    // ĐÚNG `expires_at` — chưa QUÁ hạn. `now > expires_at` mới là quá hạn; mutant
    // `>=` giết mất đúng giây cuối, và giây cuối là lúc gia đình chậm chân nhất cần.
    set_time(&e, req.expires_at);
    e.set_auths(&[]);
    w.registry.finalize_recovery(&w.account_addr);
    assert_eq!(
        w.registry.get_recovery_status(&w.account_addr).status,
        RecoveryStatus::Finalized
    );
}

/// Một giây SAU hạn dùng → chết thật (giữ chặn trên của P0-3).
#[test]
fn finalize_one_second_past_expiry_dies() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[5u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    let req = w.registry.get_recovery_status(&w.account_addr);

    set_time(&e, req.expires_at + 1);
    e.set_auths(&[]);
    let err = w
        .registry
        .try_finalize_recovery(&w.account_addr)
        .err()
        .unwrap()
        .unwrap();
    // Quá hạn thì yêu cầu không còn "đang mở" nữa — contract có thể báo hết hạn
    // hoặc báo không có yêu cầu nào; cả hai đều là "KHÔNG xoay khoá".
    assert!(
        err == RegistryError::RequestExpired.into()
            || err == RegistryError::NoActiveRecovery.into(),
        "quá hạn phải chối, nhận được {err:?}"
    );
}

/// View phải nói THẬT — ba mutant biến view thành hằng số.
/// Giết: 448 (`is_registered` → `true`), 461 (`timelock_remaining` → `1`),
/// 439 (`extend_ttl` → `()`).
///
/// `is_registered` là mutant đáng sợ nhất cả đợt: cổng ví phí của backend
/// (B-SEC-3 hàng rào 1) hỏi ĐÚNG hàm này. Nếu nó luôn trả `true` thì hàng rào vừa
/// dựng ở closeout này rỗng ruột — và không test nào từng gọi nó với ví chưa đăng ký.
#[test]
fn views_tell_the_truth_not_constants() {
    let e = Env::default();
    let w = setup(&e);

    // (1) Ví CHƯA đăng ký → false. Đây là ca âm mà cổng ví phí dựa vào.
    let stranger = Address::generate(&e);
    assert!(!w.registry.is_registered(&stranger));
    assert!(w.registry.is_registered(&w.account_addr));

    // (2) `timelock_remaining`: đầy lúc mở, 0 khi hết — không phải hằng số.
    let sk_new = SigningKey::from_bytes(&[6u8; 32]);
    w.registry.initiate_recovery(
        &w.account_addr,
        &ext_signer(&e, &w.verifier, &sk_new),
        &w.g1,
    );
    assert_eq!(w.registry.timelock_remaining(&w.account_addr), TIMELOCK);
    warp(&e, TIMELOCK / 2);
    assert_eq!(w.registry.timelock_remaining(&w.account_addr), TIMELOCK / 2);
    warp(&e, TIMELOCK);
    assert_eq!(w.registry.timelock_remaining(&w.account_addr), 0);

    // (3) `extend_ttl` KHÔNG phải no-op: nó đọc `config` nên ví chưa đăng ký phải
    //     panic. Mutant `()` bỏ cả thân hàm → không panic nữa → đỏ ở đây.
    assert!(
        w.registry.try_extend_ttl(&stranger).is_err(),
        "extend_ttl trên ví chưa đăng ký phải chối, không im lặng thành công"
    );
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

// ---------- Vector chéo Rust ↔ BE/FE: fingerprint phải TRÙNG từng byte ----------

/// Cùng vector này được pin ở BE (`public-recovery` test) — đổi công thức
/// fingerprint một bên mà quên bên kia là test hai bên cùng đỏ.
#[test]
fn signer_fingerprint_cross_language_vector() {
    let e = Env::default();
    let verifier = Address::from_str(
        &e,
        "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT",
    );
    let signer = Signer::External(verifier, Bytes::from_array(&e, &[7u8; 32]));
    let fp = crate::test_support_fingerprint(&e, &signer);
    let mut hex = std::string::String::new();
    for b in fp.to_array() {
        hex.push_str(&std::format!("{:02x}", b));
    }
    assert_eq!(
        hex,
        "cdc9947d62f44d6d81d4a532ce36da82c95465da589777c51ffdb5f9b0cda94e"
    );
}

// ---------- VETO đổi registry: người thân chặn được đường cắt-đường-cứu ----------

/// Chuỗi auth đầy đủ: guardian ký ở registry → registry gọi vào ví với tư cách
/// INVOKER → đơn đổi registry bị huỷ. Đây là đòn đỡ cho kịch bản passkey chủ ví
/// bị chiếm rồi kẻ tấn công xin trỏ ví sang registry của nó.
#[test]
fn guardian_vetoes_registry_change_through_registry() {
    let e = Env::default();
    let w = setup(&e);
    let hostile_registry = Address::generate(&e);

    w.account
        .propose_recovery_registry(&hostile_registry, &1u64);
    assert!(w.account.pending_recovery_registry().is_some());

    w.registry.veto_registry_change(&w.account_addr, &w.g1);

    assert!(w.account.pending_recovery_registry().is_none());
    // Registry hiện tại KHÔNG đổi — người thân vẫn cứu được ví.
    assert_eq!(
        w.account.get_recovery_registry(),
        Some((w.registry.address.clone(), COOLDOWN))
    );
}

/// Người lạ (không nằm trong danh sách guardian của ví) không veto được — nếu
/// không thì bất kỳ ai cũng khoá vĩnh viễn được việc chủ ví đổi registry.
#[test]
fn non_guardian_cannot_veto_registry_change() {
    let e = Env::default();
    let w = setup(&e);
    w.account
        .propose_recovery_registry(&Address::generate(&e), &1u64);

    let err = w
        .registry
        .try_veto_registry_change(&w.account_addr, &Address::generate(&e))
        .err()
        .unwrap();
    assert_eq!(err, Ok(RegistryError::NotAGuardian.into()));
    assert!(w.account.pending_recovery_registry().is_some());
}

/// TTL: gia hạn cho ví nằm im, không đòi auth ai.
#[test]
fn extend_ttl_runs_without_auth() {
    let e = Env::default();
    let w = setup(&e);
    w.registry.extend_ttl(&w.account_addr);
    assert!(w.registry.is_registered(&w.account_addr));
}

// ---------- Hồi quy audit 2026-07-25 ----------

/// P0-2: trước bản vá, `register_wallet([kẻ_tấn_công], 1, 0)` được nhận, và
/// chuỗi initiate → finalize chạy xong TRONG MỘT LEDGER (threshold ≤ 1 → Approved
/// ngay; elapsed 0 ≥ timelock 0). Chủ ví không có một giây nào để phủ quyết.
/// Bây giờ cả ba sàn đều chặn từ cửa đăng ký.
#[test]
fn register_rejects_single_guardian_takeover_shape() {
    let e = Env::default();
    let w = setup(&e);
    let attacker = Address::generate(&e);
    let victim = Address::generate(&e);

    // Đúng hình dạng khai thác cũ: một guardian, threshold 1, không thời gian chờ.
    assert_eq!(
        w.registry
            .try_register_wallet(&victim, &vec![&e, attacker.clone()], &1, &0)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TooFewGuardians.into()
    );
    // Đủ người nhưng xoá thời gian chờ → vẫn chối (không còn cửa sổ phủ quyết).
    assert_eq!(
        w.registry
            .try_register_wallet(
                &victim,
                &vec![&e, w.g1.clone(), w.g2.clone(), w.g3.clone()],
                &2,
                &0
            )
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TimelockTooShort.into()
    );
    // Ngắn hơn sàn 24h cũng chối.
    assert_eq!(
        w.registry
            .try_register_wallet(
                &victim,
                &vec![&e, w.g1.clone(), w.g2.clone(), w.g3.clone()],
                &2,
                &(TIMELOCK - 1)
            )
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::TimelockTooShort.into()
    );
}

/// P0-3: một người bảo hộ xấu mở yêu cầu rồi bỏ đó. Trước bản vá ví ĐÓNG BĂNG
/// VĨNH VIỄN: không ai mở được yêu cầu mới, không sửa được danh sách người bảo
/// hộ, và `cancel_recovery` thì cần khoá chủ ví — thứ đã mất, vì đó chính là lý
/// do phải khôi phục. Bây giờ yêu cầu treo hết hạn rồi cả nhà làm lại được.
#[test]
fn hung_request_expires_and_frees_the_wallet() {
    let e = Env::default();
    let w = setup(&e);
    let sk_new = SigningKey::from_bytes(&[9u8; 32]);
    let new_signer = ext_signer(&e, &w.verifier, &sk_new);

    // g1 mở yêu cầu rồi im lặng; g2/g3 không duyệt.
    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g1);

    // Còn trong hạn: đúng là đang chặn (đây là hành vi mong muốn).
    assert_eq!(
        w.registry
            .try_initiate_recovery(&w.account_addr, &new_signer, &w.g2)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RecoveryInProgress.into()
    );

    // Quá timelock + 7 ngày ân hạn → yêu cầu chết.
    warp(&e, TIMELOCK + 7 * 86_400 + 1);

    // Không finalize được nữa, dù đã đủ thời gian chờ.
    w.registry.approve_recovery(&w.account_addr, &w.g2);
    assert_eq!(
        w.registry
            .try_finalize_recovery(&w.account_addr)
            .err()
            .unwrap()
            .unwrap(),
        RegistryError::RequestExpired.into()
    );

    // Và quan trọng nhất: ví KHÔNG còn bị treo — g2 mở được yêu cầu mới.
    w.registry
        .initiate_recovery(&w.account_addr, &new_signer, &w.g2);
}
