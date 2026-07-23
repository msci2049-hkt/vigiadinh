//! Test account — wire OZ smart account với origin-verifier THẬT làm External signer.
//! Chứng minh: ví dựng bằng WASM hash + constructor args (không hard-code contract ID),
//! signer passkey đăng ký được, context rule mặc định tạo đúng.
//! (Luồng __check_auth crypto đầy đủ đã phủ ở origin-verifier tests — verify() account
//! gọi CHÍNH là verify() đã test ở đó.)
#![cfg(test)]
extern crate std;

use sha2::{Digest, Sha256};
use soroban_sdk::{map, vec, Address, Bytes, BytesN, Env, Map, Val, Vec};
use stellar_accounts::smart_account::Signer;

use crate::{FamilyWalletAccount, FamilyWalletAccountClient};
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
