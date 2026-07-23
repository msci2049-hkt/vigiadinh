//! Origin-enforcing WebAuthn verifier — bản TÍCH HỢP OZ (PHA 2.2).
//!
//! OZ `verifiers::webauthn::verify` CỐ Ý bỏ kiểm `origin` và `rpIdHash`
//! ("blockchain contexts rely on authenticator enforcement"). Với ví gia đình
//! 3 vỏ (web/APK/extension) điều đó KHÔNG đủ — luật K1 (stellar-security) đòi
//! allow-list origin để "chiếm extension chỉ làm được trong hộp". Verifier này
//! bọc `webauthn::verify` (giữ nguyên phần crypto + challenge=hash đã audit của OZ,
//! thoả K2/K3 vì challenge dẫn xuất từ auth_digest) rồi CHÈN THÊM:
//!   1. rpIdHash trong authenticatorData khớp giá trị pin (MỘT giá trị)
//!   2. origin trong clientDataJSON ∈ allow-list (BA giá trị)
//!
//! Interface = OZ `Verifier` trait → cắm thẳng làm External signer của OZ smart account.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, xdr::FromXdr, Bytes,
    BytesN, Env, Vec,
};
use stellar_accounts::verifiers::{
    utils::extract_from_bytes,
    webauthn::{self, WebAuthnSigData},
    Verifier,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OriginVerifierError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// rpIdHash trong authenticatorData không khớp giá trị pin (K1).
    RpIdHashMismatch = 3,
    /// origin trong clientDataJSON không nằm trong allow-list 3 vỏ (K1).
    OriginNotAllowed = 4,
    /// authenticatorData ngắn hơn 37 byte.
    AuthDataTooShort = 5,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    RpIdHash,
    AllowedOrigins,
}

#[contract]
pub struct OriginWebauthnVerifier;

#[contractimpl]
impl OriginWebauthnVerifier {
    /// Pin rpIdHash + allow-list origin một lần (mỗi hộ deploy một instance;
    /// đổi cert APK / extension ID = deploy instance mới, KHÔNG sửa code).
    pub fn __constructor(env: Env, rp_id_hash: BytesN<32>, allowed_origins: Vec<Bytes>) {
        if env.storage().instance().has(&DataKey::RpIdHash) {
            panic_with_error!(&env, OriginVerifierError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::RpIdHash, &rp_id_hash);
        env.storage()
            .instance()
            .set(&DataKey::AllowedOrigins, &allowed_origins);
    }

    pub fn config(env: Env) -> (BytesN<32>, Vec<Bytes>) {
        (rp_id_hash(&env), allowed_origins(&env))
    }
}

fn rp_id_hash(env: &Env) -> BytesN<32> {
    env.storage()
        .instance()
        .get(&DataKey::RpIdHash)
        .unwrap_or_else(|| panic_with_error!(env, OriginVerifierError::NotInitialized))
}

fn allowed_origins(env: &Env) -> Vec<Bytes> {
    env.storage()
        .instance()
        .get(&DataKey::AllowedOrigins)
        .unwrap_or_else(|| panic_with_error!(env, OriginVerifierError::NotInitialized))
}

/// Tìm needle trong haystack (clientDataJSON < 1KB → quét tuyến tính rẻ).
fn contains(haystack: &Bytes, needle: &Bytes) -> bool {
    let (h, n) = (haystack.len(), needle.len());
    if n == 0 || h < n {
        return false;
    }
    let mut i = 0u32;
    while i + n <= h {
        if haystack.slice(i..i + n) == *needle {
            return true;
        }
        i += 1;
    }
    false
}

#[contractimpl]
impl Verifier for OriginWebauthnVerifier {
    // Bytes để nhận 65-byte pubkey (+ credential id tuỳ chọn) như mẫu OZ.
    type KeyData = Bytes;
    type SigData = Bytes;

    fn verify(
        e: &Env,
        signature_payload: Bytes,
        key_data: Self::KeyData,
        sig_data: Self::SigData,
    ) -> bool {
        let sig_struct =
            WebAuthnSigData::from_xdr(e, &sig_data).expect("WebAuthnSigData with correct format");
        let pub_key: BytesN<65> =
            extract_from_bytes(e, &key_data, 0..65).expect("65-byte public key");

        // (A) K1 bổ sung — rpIdHash + origin, TRƯỚC crypto để chối rẻ.
        let auth_data = &sig_struct.authenticator_data;
        if auth_data.len() < 37 {
            panic_with_error!(e, OriginVerifierError::AuthDataTooShort);
        }
        if auth_data.slice(0..32) != Bytes::from(rp_id_hash(e)) {
            panic_with_error!(e, OriginVerifierError::RpIdHashMismatch);
        }
        let mut origin_ok = false;
        for allowed in allowed_origins(e).iter() {
            // pattern = "origin":"<allowed>"
            let mut pattern = Bytes::from_slice(e, b"\"origin\":\"");
            pattern.append(&allowed);
            pattern.push_back(b'"');
            if contains(&sig_struct.client_data, &pattern) {
                origin_ok = true;
                break;
            }
        }
        if !origin_ok {
            panic_with_error!(e, OriginVerifierError::OriginNotAllowed);
        }

        // (B) OZ audited: type=webauthn.get + challenge==base64url(payload[0..32])
        // (K2/K3 — challenge dẫn xuất từ auth_digest) + UP/UV + secp256r1_verify.
        webauthn::verify(e, &signature_payload, &pub_key, &sig_struct)
    }

    fn canonicalize_key(e: &Env, key_data: Bytes) -> Bytes {
        webauthn::canonicalize_key(e, &key_data)
    }

    fn batch_canonicalize_key(e: &Env, keys_data: Vec<Bytes>) -> Vec<Bytes> {
        webauthn::batch_canonicalize_key(e, &keys_data)
    }
}

#[cfg(test)]
mod test;
