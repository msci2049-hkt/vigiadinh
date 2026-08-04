# Mainnet core deployment evidence

Status: **NOT DEPLOYED**
Prepared: 2026-08-04 UTC
Application runtime: **Stellar Testnet**

Mainnet deployment has NOT been performed. This file is intentionally an honest pre-deployment evidence placeholder; it must not be used to claim an on-chain Mainnet deployment.

## Current rollout status

| Component | Status |
|---|---|
| Core on-chain | Not deployed on Mainnet |
| Public frontend | Testnet |
| Public backend | Testnet |
| User funds | Testnet only |
| Mainnet user onboarding | Disabled |
| Mainnet canary wallet | Not created in this task |

## Mainnet evidence table

| Contract | Mainnet contract ID | WASM hash | Upload tx | Deploy tx | Ledger | Explorer | Status |
|---|---|---|---|---|---:|---|---|
| origin-verifier | — | locked; see artifact lock | — | — | — | — | not deployed |
| web-auth | — | locked; see artifact lock | — | — | — | — | not deployed |
| recovery-registry | — | locked; see artifact lock | — | — | — | — | not deployed |
| spending-limit-policy | — | locked; see artifact lock | — | — | — | — | not deployed |
| verifier-ed25519 | not required | locked; see artifact lock | — | — | — | — | not required |
| smart-account | no global instance | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` | — | not permitted | — | — | not uploaded to Mainnet |
| native XLM SAC | pending derivation in authorized run | native SAC | none | none | none | — | derive only |

The locked versioned artifacts match the documented, verified Testnet deployment byte-for-byte. That statement is artifact provenance only; it is not Mainnet deployment evidence and it is not a security audit.

## Evidence completion rule

After an authorized run, replace the placeholders from the generated manifest and verification summary. Record the UTC time, deployment Git SHA, preparation/evidence commits, CLI and Rust versions, artifact release URL, Testnet and Mainnet hashes, transaction hashes, ledgers, constructor argument digest, explorer links, and the explorer's exact status.

Use these terms literally:

- **Deployed**: Mainnet RPC returns the instance and locked WASM hash.
- **Source-attested**: source/build attestation exists.
- **Verified**: the explorer explicitly reports verified.
- **Audited**: not established by deployment or source verification.

The following SCF sentence is approved **only after** every required Mainnet hash matches and this document contains real evidence; it is not true yet:

> Family Wallet’s core Soroban contracts have been deployed on Stellar Mainnet using versioned artifacts whose hashes were checked against the verified Testnet deployment. The public application continues to operate on Testnet while production hardening, security validation, and staged user rollout are completed.
