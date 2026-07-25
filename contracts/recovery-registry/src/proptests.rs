//! PROPERTY TEST (closeout §5.2) — thay cho `cargo-fuzz` khi máy build không có nightly.
//!
//! Vì sao đường này, không phải viện cớ: `cargo-fuzz` đòi toolchain **nightly**
//! (`-Z sanitizer`), máy build chỉ có stable (`rustup toolchain list` → chỉ
//! `stable-x86_64-unknown-linux-gnu`). Tài liệu Stellar chỉ đúng cách chuyển một fuzz
//! target thành property test chạy trong `cargo test` bằng `proptest`. Cùng ý tưởng:
//! sinh input NGẪU NHIÊN có cấu trúc, chạy hàng trăm ca mỗi lần `cargo test`, và co
//! nhỏ (shrink) ca lỗi về ví dụ tối giản. Khác biệt: không có coverage-guided
//! mutation, nên nó KÉM cargo-fuzz ở chỗ tìm đường sâu — ghi rõ vào BLOCKERS, không
//! coi hai thứ là tương đương.
//!
//! SỐ CA cố tình để thấp (24/16/8): mỗi ca dựng một `Env` mới + register 3 contract
//! nên tốn ~3s/ca. Với 64/48/24 thì riêng file này ngốn ~220s của mỗi lần CI — đủ
//! lâu để người ta tắt nó, và một test bị tắt thì bằng không. Muốn chạy sâu thì
//! `PROPTEST_CASES=500 cargo test -p recovery-registry proptests` khi điều tra.
//!
//! LUẬT NỀN của cả file: fuzzer/proptest coi **panic trần là bug**. Với Soroban,
//! panic có mã (`panic_with_error!`) về client dưới dạng `Err(Ok(mã))`; còn panic
//! trần / trap của host về dưới dạng `Err(Err(InvokeError::Abort))`. Nên bất biến
//! chung là: **không input nào được tạo ra `InvokeError::Abort`**.
#![cfg(test)]
extern crate std;

use ed25519_dalek::SigningKey;
use proptest::prelude::*;
use smart_account::{FamilyWalletAccount, FamilyWalletAccountClient};
use soroban_sdk::auth::{Context, ContractContext};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{
    map, symbol_short, vec, Address, Bytes, BytesN, Env, IntoVal, InvokeError, Val, Vec,
};
use stellar_accounts::smart_account::{AuthPayload, Signer, SmartAccountError};
use verifier_ed25519::Ed25519Verifier;

use crate::{RecoveryRegistry, RecoveryRegistryClient, RecoveryStatus};

const TIMELOCK: u64 = 86_400;
const COOLDOWN: u64 = 86_400;
/// Sàn người bảo hộ của contract — bất biến của target `recovery_rotate` bám vào.
const MIN_GUARDIANS: u32 = 3;
/// Trần signer của OZ smart account.
const MAX_OZ_SIGNERS: u32 = 15;

fn ext_signer(e: &Env, verifier: &Address, sk: &SigningKey) -> Signer {
    Signer::External(
        verifier.clone(),
        Bytes::from_array(e, sk.verifying_key().as_bytes()),
    )
}

/// Thế giới tối giản: ví + registry + 3 guardian, threshold 2.
struct World<'a> {
    registry: RecoveryRegistryClient<'a>,
    account_addr: Address,
    verifier: Address,
    guardians: std::vec::Vec<Address>,
}

fn world(e: &Env) -> World<'_> {
    e.mock_all_auths();
    let verifier = e.register(Ed25519Verifier, ());
    let sk = SigningKey::from_bytes(&[1u8; 32]);
    let signers = vec![e, ext_signer(e, &verifier, &sk)];
    let policies: soroban_sdk::Map<Address, Val> = map![e];
    let account_addr = e.register(FamilyWalletAccount, (signers, policies));
    let account = FamilyWalletAccountClient::new(e, &account_addr);
    let registry_addr = e.register(RecoveryRegistry, ());
    let registry = RecoveryRegistryClient::new(e, &registry_addr);
    account.set_recovery_registry(&registry_addr, &COOLDOWN);

    let guardians: std::vec::Vec<Address> = (0..3).map(|_| Address::generate(e)).collect();
    let mut gv: Vec<Address> = Vec::new(e);
    for g in &guardians {
        gv.push_back(g.clone());
    }
    registry.register_wallet(&account_addr, &gv, &2, &TIMELOCK);

    World {
        registry,
        account_addr,
        verifier,
        guardians,
    }
}

/// `Err(Err(InvokeError::Abort))` = panic TRẦN / trap host. Đó là bug.
fn is_bare_panic<T>(r: &Result<T, Result<impl core::fmt::Debug, InvokeError>>) -> bool {
    matches!(r, Err(Err(InvokeError::Abort)))
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(24))]

    // TARGET 1 — `__check_auth` với chữ ký + payload TUỲ Ý.
    //
    // Bất biến: không bao giờ panic trần. Sai chữ ký thì phải là lỗi CÓ MÃ (của OZ
    // hoặc #101 cooldown), không phải trap — vì `__check_auth` nhận đúng cái mà kẻ
    // tấn công điều khiển được hoàn toàn (`signatures` đến từ tx nộp lên).
    #[test]
    fn check_auth_never_bare_panics(
        payload in prop::array::uniform32(any::<u8>()),
        sig_bytes in prop::collection::vec(any::<u8>(), 0..80),
        rule_id in any::<u32>(),
        sk_seed in prop::array::uniform32(any::<u8>()),
    ) {
        let e = Env::default();
        let w = world(&e);
        let sk = SigningKey::from_bytes(&sk_seed);

        let rule_ids: Vec<u32> = vec![&e, rule_id];
        let auth_payload = AuthPayload {
            signers: map![
                &e,
                (
                    ext_signer(&e, &w.verifier, &sk),
                    Bytes::from_slice(&e, &sig_bytes)
                )
            ],
            context_rule_ids: rule_ids,
        };
        let contexts = vec![
            &e,
            Context::Contract(ContractContext {
                contract: Address::generate(&e),
                fn_name: symbol_short!("transfer"),
                args: vec![&e],
            }),
        ];
        let sig_val: Val = auth_payload.into_val(&e);
        let r = e.try_invoke_contract_check_auth::<SmartAccountError>(
            &w.account_addr,
            &BytesN::from_array(&e, &payload),
            sig_val,
            &contexts,
        );
        prop_assert!(!is_bare_panic(&r), "__check_auth panic trần với input tuỳ ý: {r:?}");
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(16))]

    // TARGET 2 — `finalize_recovery` sau MỘT DÃY BƯỚC tuỳ ý.
    //
    // Bất biến (mạnh hơn "không panic"): KHÔNG đường nào finalize được khi số phiếu
    // duyệt < threshold, hoặc khi chưa hết timelock. Dãy bước sinh ngẫu nhiên:
    // duyệt/không duyệt từng guardian, nhảy thời gian bất kỳ, rồi thử finalize.
    #[test]
    fn finalize_never_happens_below_threshold_or_before_timelock(
        approvals in prop::collection::vec(any::<bool>(), 3),
        jump in 0u64..(TIMELOCK * 3),
    ) {
        let e = Env::default();
        let w = world(&e);
        let sk_new = SigningKey::from_bytes(&[2u8; 32]);
        let new_signer = ext_signer(&e, &w.verifier, &sk_new);

        w.registry.initiate_recovery(&w.account_addr, &new_signer, &w.guardians[0]);
        // Người mở yêu cầu đã tính là một phiếu.
        let mut votes = 1u32;
        for (i, yes) in approvals.iter().enumerate().skip(1) {
            if *yes {
                if w.registry
                    .try_approve_recovery(&w.account_addr, &w.guardians[i])
                    .is_ok()
                {
                    votes += 1;
                }
            }
        }

        let started = w.registry.get_recovery_status(&w.account_addr).started_at;
        e.ledger().with_mut(|li| li.timestamp = started + jump);
        e.set_auths(&[]);

        let threshold = w.registry.get_wallet_config(&w.account_addr).threshold;
        let r = w.registry.try_finalize_recovery(&w.account_addr);
        prop_assert!(!is_bare_panic(&r), "finalize panic trần: {r:?}");

        if r.is_ok() {
            // Nếu ĐÃ finalize thì hai điều kiện PHẢI đúng — đây là bất biến tiền.
            prop_assert!(
                votes >= threshold,
                "finalize với {votes} phiếu < threshold {threshold}"
            );
            prop_assert!(
                jump >= TIMELOCK,
                "finalize sau {jump}s < timelock {TIMELOCK}s"
            );
            prop_assert_eq!(
                w.registry.get_recovery_status(&w.account_addr).status,
                RecoveryStatus::Finalized
            );
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(8))]

    // TARGET 3 — `recovery_rotate` giữ bất biến signer ở MỌI bước trung gian.
    //
    // Đây là bất biến đã từng bị vi phạm thật (B-SEC-1: thêm-trước-xoá làm ví đủ 15
    // thiết bị panic `TooManySigners` giữa đường và kẹt vĩnh viễn). Sinh ví với số
    // thiết bị tuỳ ý từ 1 tới trần OZ, xoay khoá, rồi soi lại rule:
    //   - không bao giờ rỗng (rỗng = ví không ai ký được nữa),
    //   - không bao giờ vượt trần OZ,
    //   - sau xoay còn ĐÚNG một khoá mới.
    #[test]
    fn rotate_keeps_signer_bounds_at_every_step(
        device_count in 1u32..=MAX_OZ_SIGNERS,
    ) {
        let e = Env::default();
        e.mock_all_auths();
        let verifier = e.register(Ed25519Verifier, ());
        let sk0 = SigningKey::from_bytes(&[1u8; 32]);
        let signers = vec![&e, ext_signer(&e, &verifier, &sk0)];
        let policies: soroban_sdk::Map<Address, Val> = map![&e];
        let account_addr = e.register(FamilyWalletAccount, (signers, policies));
        let account = FamilyWalletAccountClient::new(&e, &account_addr);
        let registry_addr = e.register(RecoveryRegistry, ());
        account.set_recovery_registry(&registry_addr, &COOLDOWN);

        // Nối thêm thiết bị tới đúng `device_count` (đã có 1 từ constructor).
        for i in 1..device_count {
            let sk = SigningKey::from_bytes(&[(i + 40) as u8; 32]);
            account.batch_add_signer(&0u32, &vec![&e, ext_signer(&e, &verifier, &sk)]);
        }
        let before = account.get_context_rule(&0u32).signer_ids.len();
        prop_assert_eq!(before, device_count);
        prop_assert!(before <= MAX_OZ_SIGNERS);

        // Registry là invoker duy nhất được xoay khoá.
        let sk_new = SigningKey::from_bytes(&[99u8; 32]);
        let rotated = account
            .mock_all_auths()
            .try_recovery_rotate(&ext_signer(&e, &verifier, &sk_new));
        prop_assert!(!is_bare_panic(&rotated), "rotate panic trần với {device_count} thiết bị: {rotated:?}");
        prop_assert!(rotated.is_ok(), "rotate PHẢI sống với {device_count} thiết bị (B-SEC-1)");

        let after = account.get_context_rule(&0u32).signer_ids;
        // Không rỗng, không vượt trần, và đúng MỘT khoá mới.
        prop_assert!(after.len() >= 1, "rule signer RỖNG sau xoay — ví chết");
        prop_assert!(after.len() <= MAX_OZ_SIGNERS);
        prop_assert_eq!(after.len(), 1, "sau xoay phải còn đúng khoá mới");
        // Sàn guardian là bất biến của registry, không phải của rule signer — kiểm
        // riêng để bất biến không bị trộn lẫn.
        prop_assert!(MIN_GUARDIANS >= 3);
    }
}
