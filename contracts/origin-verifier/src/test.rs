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

/// C2 (skill stellar-security): `sig_data` là input thù địch. XDR hỏng hoàn toàn
/// bị host trap ngay khi decode; XDR decode-được-nhưng-sai-shape đi vào nhánh
/// `MalformedSigData` (#6, `panic_with_error!` thay cho `.expect()` panic trần).
/// Cả hai đường đều PHẢI từ chối — verify không bao giờ trả `true` với rác. Đây là
/// bất biến fail-closed; test khoá nó (không phân biệt được new/old vì cả hai đều
/// từ chối — thay đổi code chỉ đổi panic-trần thành panic-có-mã, xem lib.rs).
#[test]
fn malformed_sig_data_never_verifies() {
    let f = setup();
    let p = [7u8; 32];
    let kd = Bytes::from_slice(&f.env, &[4u8; 65]);
    let sd = Bytes::from_slice(&f.env, &[0xFFu8; 12]); // rác, không phải WebAuthnSigData
    let r = f.client.try_verify(
        &payload_bytes(&f, &p),
        &kd.into_val(&f.env),
        &sd.into_val(&f.env),
    );
    assert!(r.is_err(), "sig_data rác không bao giờ được xác thực");
}

/// MUTANTS closeout — `contains` là hàm quyết định "origin có nằm trong
/// clientDataJSON không", tức nó LÀ allow-list origin. Ba mutant sống sót ở dòng
/// `if n == 0 || h < n` (đợt mutants toàn workspace 2026-07-25), và cả ba đều là lỗ
/// bảo mật thật, không phải nhiễu:
///
///   - `||` → `&&`: needle RỖNG không còn bị chối sớm; vòng lặp so `slice(0..0)` với
///     Bytes rỗng → `true`. Nghĩa là một origin RỖNG trong allow-list làm MỌI origin
///     được chấp nhận. Đây đúng là ca §2.3 (config production để trống) nhưng ở tầng
///     contract: dù build có gác, contract vẫn phải fail-closed.
///   - `<` → `<=` và `<` → `==`: needle DÀI BẰNG haystack bị chối oan → origin khớp
///     khít toàn bộ clientDataJSON không nhận ra được.
///
/// Test gọi thẳng `crate::contains` (submodule thấy item private của parent) vì qua
/// `verify` thì ba ca biên này không dựng được bằng chữ ký thật.
#[test]
fn contains_boundaries_are_exact() {
    let e = Env::default();
    let hay = Bytes::from_slice(&e, b"abcdef");

    // needle RỖNG → false. Không có dòng này, allow-list rỗng = cửa mở.
    assert!(
        !crate::contains(&hay, &Bytes::new(&e)),
        "needle rỗng phải bị chối — nếu không, origin rỗng khớp mọi thứ"
    );
    // needle DÀI HƠN haystack → false.
    assert!(!crate::contains(&hay, &Bytes::from_slice(&e, b"abcdefg")));
    // needle DÀI BẰNG haystack và khớp → true (biên h == n).
    assert!(
        crate::contains(&hay, &Bytes::from_slice(&e, b"abcdef")),
        "khớp khít toàn bộ vẫn phải là khớp"
    );
    // needle dài bằng nhưng KHÁC → false.
    assert!(!crate::contains(&hay, &Bytes::from_slice(&e, b"abcdez")));
    // Khớp ở giữa + ở cuối — giữ hành vi quét tuyến tính.
    assert!(crate::contains(&hay, &Bytes::from_slice(&e, b"cd")));
    assert!(crate::contains(&hay, &Bytes::from_slice(&e, b"ef")));
}

/// MUTANTS closeout — `auth_data.len() < 37` là cổng chặn authenticatorData cụt
/// TRƯỚC khi slice `0..32` (rpIdHash) và đọc cờ UV ở byte 32. Mutant `<` → `>` sống
/// vì MỌI test cũ dựng authData dài ĐÚNG 37 byte, và `37 > 37` cũng false → không
/// test nào phân biệt được. Ca này dùng authData NGẮN và đòi ĐÚNG mã lỗi: với mutant
/// `>`, authData 20 byte đi lọt cổng rồi chết ở chỗ khác (mã khác) → assert đỏ.
#[test]
fn auth_data_shorter_than_37_rejected_with_its_own_code() {
    let f = setup();
    let p = [9u8; 32];
    let cdj = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
        b64url(&p),
        ORIGIN_WEB
    );
    let sig_struct = WebAuthnSigData {
        signature: BytesN::from_array(&f.env, &[0u8; 64]),
        // 36 byte = thiếu ĐÚNG một byte so với sàn 37 (32 rpIdHash + 1 flags + 4 counter).
        authenticator_data: Bytes::from_slice(&f.env, &[0u8; 36]),
        client_data: Bytes::from_slice(&f.env, cdj.as_bytes()),
    };
    let kd = Bytes::from_slice(&f.env, &[4u8; 65]);
    let sd = sig_struct.to_xdr(&f.env);
    let r = f.client.try_verify(
        &payload_bytes(&f, &p),
        &kd.into_val(&f.env),
        &sd.into_val(&f.env),
    );
    assert_eq!(
        r,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            OriginVerifierError::AuthDataTooShort as u32
        ))),
        "authData cụt phải chối bằng chính mã của nó, không phải lỗi tình cờ ở sau"
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
