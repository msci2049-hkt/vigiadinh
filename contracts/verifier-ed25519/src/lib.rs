//! Ed25519 verifier — External signer KHÔNG-WebAuthn cho OZ smart account.
//!
//! Dùng cho: (a) e2e BE ký bằng keypair ed25519 thuần (máy CI không có
//! authenticator), (b) signer dự phòng dạng khoá lạnh người dùng TỰ giữ
//! (không phải backend — bất biến 2 không đổi). Crypto = OZ
//! `verifiers::ed25519` (audited), contract này chỉ bọc thành Verifier trait
//! để cắm vào `Signer::External`.
#![no_std]

use soroban_sdk::{contract, contractimpl, Bytes, BytesN, Env, Vec};
use stellar_accounts::verifiers::{ed25519, Verifier};

#[contract]
pub struct Ed25519Verifier;

#[contractimpl]
impl Verifier for Ed25519Verifier {
    type KeyData = BytesN<32>;
    type SigData = BytesN<64>;

    fn verify(
        e: &Env,
        signature_payload: Bytes,
        key_data: Self::KeyData,
        sig_data: Self::SigData,
    ) -> bool {
        ed25519::verify(e, &signature_payload, &key_data, &sig_data)
    }

    fn canonicalize_key(e: &Env, key_data: Self::KeyData) -> Bytes {
        ed25519::canonicalize_key(e, &key_data)
    }

    /// OZ smart account gọi khi validate trùng signer (canonical key so sánh).
    fn batch_canonicalize_key(e: &Env, keys: Vec<Self::KeyData>) -> Vec<Bytes> {
        ed25519::batch_canonicalize_key(e, &keys)
    }
}

#[cfg(test)]
mod test;
