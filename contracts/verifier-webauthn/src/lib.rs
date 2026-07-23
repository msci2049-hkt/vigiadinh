//! Verifier WebAuthn secp256r1 — trái tim spike gate 3 (PHA 2, skill passkey §6).
//!
//! Luật K1 (stellar-security): kiểm `rpIdHash` (MỘT giá trị pin lúc khởi tạo) +
//! **allow-list `origin`** (BA giá trị: web https://…, APK android:apk-key-hash:…,
//! extension chrome-extension://…). Cả hai đều nằm trong dữ liệu ĐƯỢC KÝ:
//! rpIdHash ở authenticatorData[0..32], origin ở clientDataJSON.
//! Luật K2: challenge do CALLER đưa vào (dẫn xuất từ tx đã simulate) — verifier so
//! khớp base64url(challenge) trong clientDataJSON, KHÔNG tự sinh random.
//!
//! Verify chữ ký: message = authenticatorData || sha256(clientDataJSON),
//! digest = sha256(message) → env.crypto().secp256r1_verify (host panic nếu sai).
#![no_std]

use soroban_sdk::{
    bytes, contract, contracterror, contractimpl, panic_with_error, Bytes, BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VerifierError {
    /// authenticatorData ngắn hơn 37 byte (32 rpIdHash + 1 flags + 4 counter).
    AuthDataTooShort = 1,
    /// rpIdHash trong authenticatorData không khớp giá trị pin.
    RpIdHashMismatch = 2,
    /// Thiếu cờ User Presence / User Verification (yêu cầu biometric).
    FlagsMissing = 3,
    /// clientDataJSON không mở đầu bằng {"type":"webauthn.get","challenge":"<b64url>"
    /// — sai type hoặc challenge không khớp (K2: ký mù bị chặn ở đây).
    ChallengeOrTypeMismatch = 4,
    /// origin trong clientDataJSON không nằm trong allow-list 3 vỏ.
    OriginNotAllowed = 5,
    /// Đã khởi tạo rồi — cấm ghi đè cấu hình.
    AlreadyInitialized = 6,
    /// Chưa khởi tạo.
    NotInitialized = 7,
}

/// Key storage instance (cấu hình verifier — sống cùng contract, có TTL extend).
#[derive(Clone)]
#[soroban_sdk::contracttype]
pub enum DataKey {
    /// sha256(rpId) — MỘT giá trị.
    RpIdHash,
    /// Allow-list origin — BA giá trị (web / APK / extension).
    AllowedOrigins,
}

#[contract]
pub struct WebauthnVerifier;

#[contractimpl]
impl WebauthnVerifier {
    /// Khởi tạo một lần: pin rpIdHash + allow-list origin.
    /// (Constructor-style; tách hàm riêng để test đổi cấu hình dễ — production
    /// deploy mỗi hộ một verifier config qua constructor args ở PHA sau.)
    pub fn __constructor(env: Env, rp_id_hash: BytesN<32>, allowed_origins: Vec<Bytes>) {
        if env.storage().instance().has(&DataKey::RpIdHash) {
            panic_with_error!(&env, VerifierError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::RpIdHash, &rp_id_hash);
        env.storage()
            .instance()
            .set(&DataKey::AllowedOrigins, &allowed_origins);
    }

    /// Xác thực một assertion WebAuthn. Panic với mã lỗi cụ thể khi sai —
    /// caller (smart account __check_auth) coi panic = chữ ký không hợp lệ.
    ///
    /// * `public_key`  — SEC1 uncompressed 65 byte (0x04 || X || Y) của passkey.
    /// * `challenge`   — 32 byte dẫn xuất từ tx đã simulate (K2).
    /// * `auth_data`   — authenticatorData nguyên văn từ authenticator.
    /// * `client_data` — clientDataJSON nguyên văn.
    /// * `signature`   — ECDSA r||s 64 byte (low-S).
    pub fn verify(
        env: Env,
        public_key: BytesN<65>,
        challenge: BytesN<32>,
        auth_data: Bytes,
        client_data: Bytes,
        signature: BytesN<64>,
    ) {
        let rp_id_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::RpIdHash)
            .unwrap_or_else(|| panic_with_error!(&env, VerifierError::NotInitialized));
        let allowed: Vec<Bytes> = env
            .storage()
            .instance()
            .get(&DataKey::AllowedOrigins)
            .unwrap_or_else(|| panic_with_error!(&env, VerifierError::NotInitialized));

        // 1) authenticatorData: rpIdHash + flags (UP 0x01, UV 0x04 — passkey biometric).
        if auth_data.len() < 37 {
            panic_with_error!(&env, VerifierError::AuthDataTooShort);
        }
        let got_rp_hash: Bytes = auth_data.slice(0..32);
        if got_rp_hash != Bytes::from(rp_id_hash) {
            panic_with_error!(&env, VerifierError::RpIdHashMismatch);
        }
        let flags = auth_data.get(32).unwrap();
        if flags & 0x01 == 0 || flags & 0x04 == 0 {
            panic_with_error!(&env, VerifierError::FlagsMissing);
        }

        // 2) K2 — thuật toán "limited verification" của spec WebAuthn §5.8.1.1:
        // serialization của authenticator LUÔN mở đầu
        // {"type":"webauthn.get","challenge":"<base64url không padding>"
        // → so PREFIX exact, không cần parser JSON đầy đủ trong no_std.
        let mut expected_prefix = bytes!(
            &env,
            0x7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22
        );
        // 0x7b..22 = {"type":"webauthn.get","challenge":"
        expected_prefix.append(&base64url_encode_32(&env, &challenge));
        expected_prefix.push_back(0x22); // dấu " đóng challenge
        let plen = expected_prefix.len();
        if client_data.len() < plen || client_data.slice(0..plen) != expected_prefix {
            panic_with_error!(&env, VerifierError::ChallengeOrTypeMismatch);
        }

        // 3) K1 — origin ∈ allow-list. Tìm chuỗi "origin":"<allowed>" trong phần còn
        // lại của clientDataJSON (sau prefix đã kiểm — challenge đã bind nên nội dung
        // này do authenticator serialize, không phải attacker tự do).
        let mut origin_ok = false;
        for allowed_origin in allowed.iter() {
            // pattern = "origin":"<allowed>"
            let mut pattern = bytes!(&env, 0x226f726967696e223a22); // "origin":"
            pattern.append(&allowed_origin);
            pattern.push_back(0x22);
            if contains(&client_data, &pattern) {
                origin_ok = true;
                break;
            }
        }
        if !origin_ok {
            panic_with_error!(&env, VerifierError::OriginNotAllowed);
        }

        // 4) Chữ ký: digest = sha256(authData || sha256(clientDataJSON)).
        let cdj_hash: BytesN<32> = env.crypto().sha256(&client_data).to_bytes();
        let mut message = auth_data.clone();
        message.append(&Bytes::from(cdj_hash));
        let digest = env.crypto().sha256(&message);
        // Host function panic nếu chữ ký sai — đó chính là kết quả "chối".
        env.crypto()
            .secp256r1_verify(&public_key, &digest, &signature);
    }

    /// Đọc cấu hình (phục vụ kiểm tra/audit).
    pub fn config(env: Env) -> (BytesN<32>, Vec<Bytes>) {
        let rp: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::RpIdHash)
            .unwrap_or_else(|| panic_with_error!(&env, VerifierError::NotInitialized));
        let origins: Vec<Bytes> = env
            .storage()
            .instance()
            .get(&DataKey::AllowedOrigins)
            .unwrap_or_else(|| panic_with_error!(&env, VerifierError::NotInitialized));
        (rp, origins)
    }
}

/// base64url (không padding) cho đúng 32 byte → 43 ký tự. Bảng mã RFC 4648 §5.
fn base64url_encode_32(env: &Env, input: &BytesN<32>) -> Bytes {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let raw = input.to_array();
    let mut out = Bytes::new(env);
    let mut i = 0;
    while i + 3 <= 32 {
        let n = ((raw[i] as u32) << 16) | ((raw[i + 1] as u32) << 8) | raw[i + 2] as u32;
        out.push_back(ALPHABET[(n >> 18) as usize & 63]);
        out.push_back(ALPHABET[(n >> 12) as usize & 63]);
        out.push_back(ALPHABET[(n >> 6) as usize & 63]);
        out.push_back(ALPHABET[n as usize & 63]);
        i += 3;
    }
    // 32 = 10*3 + 2 byte dư → 3 ký tự cuối, không padding.
    let n = ((raw[30] as u32) << 16) | ((raw[31] as u32) << 8);
    out.push_back(ALPHABET[(n >> 18) as usize & 63]);
    out.push_back(ALPHABET[(n >> 12) as usize & 63]);
    out.push_back(ALPHABET[(n >> 6) as usize & 63]);
    out
}

/// Tìm needle trong haystack (quét tuyến tính — clientDataJSON < 1KB nên rẻ).
fn contains(haystack: &Bytes, needle: &Bytes) -> bool {
    let h = haystack.len();
    let n = needle.len();
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

#[cfg(test)]
mod test;
