//! Test verifier — mô phỏng authenticator passkey bằng p256 (dev-dep).
//! Gate 3 spike: MỘT credential (một key) ký từ BA origin → verifier phải nhận cả ba,
//! origin lạ phải bị chối bằng đúng mã lỗi.
#![cfg(test)]

extern crate std;

use p256::ecdsa::signature::hazmat::PrehashSigner;
use p256::ecdsa::{Signature, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{testutils::BytesN as _, vec, Bytes, BytesN, Env, Vec};

use crate::{VerifierError, WebauthnVerifier, WebauthnVerifierClient};

const RP_ID: &str = "vigiadinh.com";
const ORIGIN_WEB: &str = "https://vigiadinh.com";
const ORIGIN_APK: &str = "android:apk-key-hash:TEST";
const ORIGIN_EXT: &str = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

fn b64url(data: &[u8]) -> std::string::String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = std::vec::Vec::new();
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(A[(n >> 18) as usize & 63]);
        out.push(A[(n >> 12) as usize & 63]);
        if chunk.len() > 1 {
            out.push(A[(n >> 6) as usize & 63]);
        }
        if chunk.len() > 2 {
            out.push(A[n as usize & 63]);
        }
    }
    std::string::String::from_utf8(out).unwrap()
}

/// authenticatorData chuẩn: sha256(rpId) + flags + counter 0.
fn auth_data_bytes(flags: u8) -> std::vec::Vec<u8> {
    let mut ad = Sha256::digest(RP_ID.as_bytes()).to_vec();
    ad.push(flags);
    ad.extend_from_slice(&[0, 0, 0, 0]);
    ad
}

/// clientDataJSON đúng serialization của authenticator thật.
fn client_data_json(challenge: &[u8; 32], origin: &str) -> std::string::String {
    std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
        b64url(challenge),
        origin
    )
}

/// Ký một assertion: trả (public_key 65B, signature 64B low-S).
fn sign_assertion(key: &SigningKey, auth_data: &[u8], client_data: &[u8]) -> ([u8; 65], [u8; 64]) {
    let mut message = auth_data.to_vec();
    message.extend_from_slice(&Sha256::digest(client_data));
    let digest: [u8; 32] = Sha256::digest(&message).into();
    let sig: Signature = key.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let vk = VerifyingKey::from(key);
    let pk_point = vk.to_encoded_point(false);
    let mut pk = [0u8; 65];
    pk.copy_from_slice(pk_point.as_bytes());
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&sig.to_bytes());
    (pk, sig_bytes)
}

struct Fixture {
    env: Env,
    client: WebauthnVerifierClient<'static>,
    key: SigningKey,
}

fn setup() -> Fixture {
    let env = Env::default();
    let rp_hash: [u8; 32] = Sha256::digest(RP_ID.as_bytes()).into();
    let rp_hash = BytesN::from_array(&env, &rp_hash);
    let origins: Vec<Bytes> = vec![
        &env,
        Bytes::from_slice(&env, ORIGIN_WEB.as_bytes()),
        Bytes::from_slice(&env, ORIGIN_APK.as_bytes()),
        Bytes::from_slice(&env, ORIGIN_EXT.as_bytes()),
    ];
    let id = env.register(WebauthnVerifier, (rp_hash, origins));
    let client = WebauthnVerifierClient::new(&env, &id);
    // Key cố định cho reproducibility (chỉ test).
    let key = SigningKey::from_bytes((&[7u8; 32]).into()).unwrap();
    Fixture { env, client, key }
}

fn verify_with(f: &Fixture, challenge: [u8; 32], origin: &str, flags: u8) {
    let ad = auth_data_bytes(flags);
    let cdj = client_data_json(&challenge, origin);
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    f.client.verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
}

/// GATE 3 — MỘT key, BA origin: cả ba phải qua.
#[test]
fn one_credential_three_origins_all_pass() {
    let f = setup();
    verify_with(&f, [1u8; 32], ORIGIN_WEB, 0x05);
    verify_with(&f, [2u8; 32], ORIGIN_APK, 0x05);
    verify_with(&f, [3u8; 32], ORIGIN_EXT, 0x05);
}

#[test]
fn unknown_origin_rejected() {
    let f = setup();
    let challenge = [4u8; 32];
    let ad = auth_data_bytes(0x05);
    let cdj = client_data_json(&challenge, "https://evil.example");
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            VerifierError::OriginNotAllowed as u32
        )))
    );
}

#[test]
fn wrong_rp_id_hash_rejected() {
    let f = setup();
    let challenge = [5u8; 32];
    // authenticatorData ký cho rpId khác → mismatch với giá trị pin.
    let mut ad = Sha256::digest(b"evil.example").to_vec();
    ad.push(0x05);
    ad.extend_from_slice(&[0, 0, 0, 0]);
    let cdj = client_data_json(&challenge, ORIGIN_WEB);
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            VerifierError::RpIdHashMismatch as u32
        )))
    );
}

/// K2 — challenge trong clientDataJSON khác challenge caller đưa → chối.
#[test]
fn challenge_mismatch_rejected() {
    let f = setup();
    let ad = auth_data_bytes(0x05);
    let cdj = client_data_json(&[6u8; 32], ORIGIN_WEB); // authenticator ký challenge [6..]
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    let expected = [7u8; 32]; // caller chờ challenge [7..]
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &expected),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            VerifierError::ChallengeOrTypeMismatch as u32
        )))
    );
}

#[test]
fn missing_uv_flag_rejected() {
    let f = setup();
    let challenge = [8u8; 32];
    let ad = auth_data_bytes(0x01); // chỉ UP, thiếu UV (biometric)
    let cdj = client_data_json(&challenge, ORIGIN_WEB);
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            VerifierError::FlagsMissing as u32
        )))
    );
}

/// Chữ ký hỏng (đổi 1 byte) → host secp256r1_verify chối (panic ≠ contracterror).
#[test]
fn tampered_signature_rejected() {
    let f = setup();
    let challenge = [9u8; 32];
    let ad = auth_data_bytes(0x05);
    let cdj = client_data_json(&challenge, ORIGIN_WEB);
    let (pk, mut sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    sig[10] ^= 0xff;
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert!(r.is_err(), "chữ ký sửa 1 byte phải bị chối, got {:?}", r);
}

/// Nội dung tx đổi sau khi ký (K3 tinh thần): authData giữ, clientDataJSON giữ,
/// nhưng challenge caller = hash tx MỚI → phải chối ngay từ bước challenge.
#[test]
fn replay_with_new_tx_rejected() {
    let f = setup();
    let old_tx_challenge = [10u8; 32];
    let ad = auth_data_bytes(0x05);
    let cdj = client_data_json(&old_tx_challenge, ORIGIN_WEB);
    let (pk, sig) = sign_assertion(&f.key, &ad, cdj.as_bytes());
    let new_tx_challenge = [11u8; 32];
    let r = f.client.try_verify(
        &BytesN::from_array(&f.env, &pk),
        &BytesN::from_array(&f.env, &new_tx_challenge),
        &Bytes::from_slice(&f.env, &ad),
        &Bytes::from_slice(&f.env, cdj.as_bytes()),
        &BytesN::from_array(&f.env, &sig),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            VerifierError::ChallengeOrTypeMismatch as u32
        )))
    );
}

#[test]
fn config_readable() {
    let f = setup();
    let (rp, origins) = f.client.config();
    let expected: [u8; 32] = Sha256::digest(RP_ID.as_bytes()).into();
    assert_eq!(rp, BytesN::from_array(&f.env, &expected));
    assert_eq!(origins.len(), 3);
}
