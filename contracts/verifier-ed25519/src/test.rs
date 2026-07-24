//! Ký thật bằng ed25519-dalek → verifier chấp nhận; sửa 1 byte → chối.
#![cfg(test)]
extern crate std;

use ed25519_dalek::{Signer as DalekSigner, SigningKey};
use soroban_sdk::{vec, Bytes, BytesN, Env};

use crate::{Ed25519Verifier, Ed25519VerifierClient};

fn setup(e: &Env) -> (Ed25519VerifierClient<'_>, SigningKey, BytesN<32>) {
    let id = e.register(Ed25519Verifier, ());
    let client = Ed25519VerifierClient::new(e, &id);
    let sk = SigningKey::from_bytes(&[7u8; 32]);
    let pk = BytesN::from_array(e, sk.verifying_key().as_bytes());
    (client, sk, pk)
}

#[test]
fn valid_signature_accepted() {
    let e = Env::default();
    let (client, sk, pk) = setup(&e);
    let payload = [42u8; 32];
    let sig: [u8; 64] = sk.sign(&payload).to_bytes();
    let ok = client.verify(
        &Bytes::from_array(&e, &payload),
        &pk,
        &BytesN::from_array(&e, &sig),
    );
    assert!(ok);
}

#[test]
#[should_panic]
fn tampered_signature_rejected() {
    let e = Env::default();
    let (client, sk, pk) = setup(&e);
    let payload = [42u8; 32];
    let mut sig: [u8; 64] = sk.sign(&payload).to_bytes();
    sig[10] ^= 0xff;
    client.verify(
        &Bytes::from_array(&e, &payload),
        &pk,
        &BytesN::from_array(&e, &sig),
    );
}

#[test]
fn canonicalize_preserves_order() {
    let e = Env::default();
    let (client, _, pk) = setup(&e);
    let other = BytesN::from_array(&e, &[9u8; 32]);
    let out = client.batch_canonicalize_key(&vec![&e, pk.clone(), other.clone()]);
    assert_eq!(out.len(), 2);
    assert_eq!(out.get_unchecked(0), Bytes::from(pk));
    assert_eq!(out.get_unchecked(1), Bytes::from(other));
}
