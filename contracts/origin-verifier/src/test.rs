//! Test origin-verifier (OZ Verifier trait) — MỘT key secp256r1 ký challenge = auth_digest
//! cho BA origin → verify true; origin lạ → panic OriginNotAllowed.
#![cfg(test)]
extern crate std;

use p256::ecdsa::signature::hazmat::PrehashSigner;
use p256::ecdsa::{Signature, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{vec, xdr::ToXdr, Bytes, BytesN, Env, IntoVal, Vec};
use stellar_accounts::verifiers::webauthn::WebAuthnSigData;

use crate::{OriginVerifierError, OriginWebauthnVerifier, OriginWebauthnVerifierClient};

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

struct Fx {
    env: Env,
    client: OriginWebauthnVerifierClient<'static>,
    key: SigningKey,
}

fn setup() -> Fx {
    let env = Env::default();
    env.mock_all_auths();
    let rp_hash: [u8; 32] = Sha256::digest(RP_ID.as_bytes()).into();
    let origins: Vec<Bytes> = vec![
        &env,
        Bytes::from_slice(&env, ORIGIN_WEB.as_bytes()),
        Bytes::from_slice(&env, ORIGIN_APK.as_bytes()),
        Bytes::from_slice(&env, ORIGIN_EXT.as_bytes()),
    ];
    let id = env.register(
        OriginWebauthnVerifier,
        (BytesN::from_array(&env, &rp_hash), origins),
    );
    let client = OriginWebauthnVerifierClient::new(&env, &id);
    let key = SigningKey::from_bytes((&[7u8; 32]).into()).unwrap();
    Fx { env, client, key }
}

/// Tạo (key_data 65B, sig_data XDR WebAuthnSigData) cho một payload 32B + origin.
fn make_assertion(f: &Fx, payload: &[u8; 32], origin: &str) -> (Bytes, Bytes) {
    let mut auth_data = Sha256::digest(RP_ID.as_bytes()).to_vec();
    auth_data.push(0x05); // UP + UV
    auth_data.extend_from_slice(&[0, 0, 0, 0]);

    let cdj = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
        b64url(payload),
        origin
    );

    // Chữ ký: message = authData || sha256(clientDataJSON) — như OZ webauthn::verify.
    let mut message = auth_data.clone();
    message.extend_from_slice(&Sha256::digest(cdj.as_bytes()));
    let digest: [u8; 32] = Sha256::digest(&message).into();
    let sig: Signature = f.key.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&sig.to_bytes());

    let vk = VerifyingKey::from(&f.key);
    let pk_point = vk.to_encoded_point(false);
    let mut pk = [0u8; 65];
    pk.copy_from_slice(pk_point.as_bytes());

    let sig_struct = WebAuthnSigData {
        signature: BytesN::from_array(&f.env, &sig_bytes),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data: Bytes::from_slice(&f.env, cdj.as_bytes()),
    };
    let key_data = Bytes::from_slice(&f.env, &pk);
    let sig_data = sig_struct.to_xdr(&f.env);
    (key_data, sig_data)
}

fn payload_bytes(f: &Fx, p: &[u8; 32]) -> Bytes {
    Bytes::from_slice(&f.env, p)
}

/// GATE 3 (bản OZ-trait): MỘT key, BA origin — verify true cả ba.
#[test]
fn one_credential_three_origins_all_pass() {
    let f = setup();
    for (p, origin) in [
        ([1u8; 32], ORIGIN_WEB),
        ([2u8; 32], ORIGIN_APK),
        ([3u8; 32], ORIGIN_EXT),
    ] {
        let (kd, sd) = make_assertion(&f, &p, origin);
        assert!(
            f.client.verify(&payload_bytes(&f, &p), &kd, &sd),
            "origin {origin} phải qua"
        );
    }
}

#[test]
fn unknown_origin_rejected() {
    let f = setup();
    let p = [4u8; 32];
    let (kd, sd) = make_assertion(&f, &p, "https://evil.example");
    let r = f.client.try_verify(
        &payload_bytes(&f, &p),
        &kd.into_val(&f.env),
        &sd.into_val(&f.env),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            OriginVerifierError::OriginNotAllowed as u32
        )))
    );
}

#[test]
fn wrong_rp_id_hash_rejected() {
    let f = setup();
    let p = [5u8; 32];
    // authData ký cho rpId khác.
    let mut auth_data = Sha256::digest(b"evil.example").to_vec();
    auth_data.push(0x05);
    auth_data.extend_from_slice(&[0, 0, 0, 0]);
    let cdj = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
        b64url(&p),
        ORIGIN_WEB
    );
    let mut message = auth_data.clone();
    message.extend_from_slice(&Sha256::digest(cdj.as_bytes()));
    let digest: [u8; 32] = Sha256::digest(&message).into();
    let sig: Signature = f.key.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&sig.to_bytes());
    let vk = VerifyingKey::from(&f.key);
    let pk = vk.to_encoded_point(false);
    let mut pkb = [0u8; 65];
    pkb.copy_from_slice(pk.as_bytes());
    let sig_struct = WebAuthnSigData {
        signature: BytesN::from_array(&f.env, &sig_bytes),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data: Bytes::from_slice(&f.env, cdj.as_bytes()),
    };
    let kd = Bytes::from_slice(&f.env, &pkb);
    let sd = sig_struct.to_xdr(&f.env);
    let r = f.client.try_verify(
        &payload_bytes(&f, &p),
        &kd.into_val(&f.env),
        &sd.into_val(&f.env),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            OriginVerifierError::RpIdHashMismatch as u32
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
