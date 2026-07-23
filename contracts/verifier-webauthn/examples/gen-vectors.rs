//! Sinh vector Gate 3 (PHA 2 spike): MỘT key secp256r1 (mô phỏng passkey) ký assertion
//! WebAuthn cho BA origin + MỘT origin lạ. In hex để ném vào verifier trên TESTNET
//! qua stellar CLI. Chạy: `cargo run --example gen-vectors`.
use p256::ecdsa::signature::hazmat::PrehashSigner;
use p256::ecdsa::{Signature, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

const RP_ID: &str = "vigiadinh.com";

fn b64url(data: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = Vec::new();
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
    String::from_utf8(out).unwrap()
}

fn hex(data: &[u8]) -> String {
    data.iter().map(|b| format!("{b:02x}")).collect()
}

fn main() {
    // Key cố định — spike reproducible. KHÔNG phải key thật của ai.
    let key = SigningKey::from_bytes((&[7u8; 32]).into()).unwrap();
    let vk = VerifyingKey::from(&key);
    let pk = vk.to_encoded_point(false);

    let rp_hash = Sha256::digest(RP_ID.as_bytes());
    println!("rp_id           = {RP_ID}");
    println!("rp_id_hash      = {}", hex(&rp_hash));
    println!("public_key(65B) = {}", hex(pk.as_bytes()));
    println!();

    let origins = [
        ("web", "https://vigiadinh.com", 0x11u8),
        ("apk", "android:apk-key-hash:TEST", 0x22),
        (
            "ext",
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
            0x33,
        ),
        ("evil", "https://evil.example", 0x44),
    ];
    for (label, origin, seed) in origins {
        let challenge = [seed; 32];
        let mut ad = rp_hash.to_vec();
        ad.push(0x05); // UP + UV
        ad.extend_from_slice(&[0, 0, 0, 0]);
        let cdj = format!(
            "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
            b64url(&challenge),
            origin
        );
        let mut message = ad.clone();
        message.extend_from_slice(&Sha256::digest(cdj.as_bytes()));
        let digest: [u8; 32] = Sha256::digest(&message).into();
        let sig: Signature = key.sign_prehash(&digest).unwrap();
        let sig = sig.normalize_s().unwrap_or(sig);
        println!("## {label}: origin = {origin}");
        println!("challenge   = {}", hex(&challenge));
        println!("auth_data   = {}", hex(&ad));
        println!("client_data = {}", hex(cdj.as_bytes()));
        println!("signature   = {}", hex(&sig.to_bytes()));
        println!("origin_hex  = {}", hex(origin.as_bytes()));
        println!();
    }
}
