# Mainnet core deployment audit

Audit date: 2026-08-04 UTC. Base repository commit: `63ad69ceef0160adb6cb5d30fd6ca5b072235ae6`. Outcome at preparation time: **NOT DEPLOYED**.

## Repository and dependency findings

1. **Workspace packages.** Seven contract packages exist: `origin-verifier`, `web-auth`, `recovery-registry`, `spending-limit-policy`, `verifier-ed25519`, `verifier-webauthn`, and `smart-account`. `verifier-webauthn` is a spike and is not wired into the application deployment set.
2. **Constructors.** `origin-verifier`, `verifier-webauthn`, and `smart-account` expose `__constructor`. The deployable application contracts `web-auth`, `recovery-registry`, `spending-limit-policy`, and `verifier-ed25519` do not.
3. **Exact arguments.** `origin-verifier`: `rp_id_hash: BytesN<32>`, `allowed_origins: Vec<Bytes>`. `verifier-webauthn`: the same two types. `smart-account`: `signers: Vec<Signer>`, `policies: Map<Address, Val>`.
4. **Dependencies.** Origin verification is selected as an account signer verifier at wallet construction time, not hard-coded into another global contract. Recovery registry stores per-wallet state after `register_wallet` and invokes that supplied smart-account address for recovery operations. Spending policy is installed per smart-account rule. Web-auth validates authenticated SEP-45 input and has no verifier address. No source contains a fixed Testnet dependency address.
5. **`verifier-ed25519`.** It is an optional verifier for an Ed25519/cold-key signer. The passkey Mainnet core has no fixed dependency on it, so `required=false` and it is not uploaded or deployed.
6. **`web-auth`.** It takes no verifier address and has no constructor. `web_auth_verify(Map<Symbol, String>)` relies on account/server/client authorization.
7. **`origin-verifier` initialization.** RP ID hash and allowed origins are pinned in the constructor; there is no separate init call.
8. **`recovery-registry` initialization.** There is no constructor. State is created for a wallet by `register_wallet`; this workflow creates no wallet state.
9. **`spending-limit-policy` initialization.** There is no constructor. State is initialized by `install` for a smart-account rule; this workflow installs no rule.
10. **`smart-account`.** Only the WASM code is globally required. No global smart-account instance is required, and this task must not construct a user wallet.
11. **Release artifacts.** The five v0.1.0 assets are from per-contract tags in `msci2049-hkt/vigiadinh`; spending policy is from its v0.1.1 release tag. Exact tags, asset names, commits, and hashes are locked in `contracts/deployments/mainnet/artifacts.lock.json`.
12. **Testnet artifact set.** All six local release bytes match the Testnet on-chain hash or, for smart-account, the Testnet code hash. They are versioned per-contract rather than one monolithic release: most v0.1.0 tags resolve to `da689235...`; spending v0.1.1 has release tag commit `392241f...` and build attestation commit `96957faa...`.
13. **Build toolchain.** WASM metadata reports protocol 26, Rust `1.97.1`, SDK `26.1.1`, CLI `27.0.0`, and `source_repo=github:msci2049-hkt/vigiadinh`. The WASMs do not contain `source_repo_commit`; the commit link comes from release/attestation evidence and is recorded separately. Mainnet operations are pinned to Stellar CLI 26.1.0.
14. **Existing deployment script.** `contracts/scripts/deploy-origin-verifier.sh` correctly documents the constructor and byte encoding, but is not safe enough for this run because it has no artifact lock, fee budget, official transaction receipt capture, idempotent manifest, or full Mainnet gate. Only its source-derived encoding was reused.
15. **Source metadata.** Every inspected WASM contains `source_repo`. None contains `source_repo_commit`. This absence is explicit; it is not silently inferred from the bytes.
16. **Origin production lock.** A read-only Testnet `origin-verifier::config` call returned the SHA-256 RP ID for `familyhaven.mscilabs.com` and the ordered web/API/production-extension origins now recorded in the artifact lock. Mainnet preflight rejects any different value.

No Rust source change was needed. A required Rust change would have blocked the deployment.

## Provenance cross-check

| Contract | Locked/Testnet WASM hash | Testnet reference | Result |
|---|---|---|---|
| origin-verifier | `5f41462676ef708519915f79367292c8bff6a3d2894931a5d1638a29748886a8` | `CBFCNHIOQN3N5IVSIVW4TTKYXZ73YQI4DZPADC6UCWF2XU35W4GVVWGW` | byte/hash match |
| web-auth | `4c0ad10d38ac7ee0c0c842dc4bd897d467f61420f79731639950735b04aaa524` | `CBWMHVEEXEOSOSWULYNYN62EYVMWJT55NKRPUI2MXSYHVVZ6NIMRJBWD` | byte/hash match |
| recovery-registry | `f45bbdb3fa2682fb2d1f3314de7924edf7eefab79dff3c602897742b928a4d26` | `CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR` | byte/hash match |
| spending-limit-policy | `13fab007bba18c6ad42d28818126dd1c403cf7fda6319faf71b55b4ec4b44a55` | `CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK` | byte/hash match |
| verifier-ed25519 | `369a1f5c83dc5b761a5e8c490d8c7e05222c374a72df30e93cef1200af3d06f9` | `CC7L7IGJ7ZBUQCYUTV6J6KLKMKYKAZIV5FMRISPNIZZW63664TWOVDEE` | byte/hash match; not required |
| smart-account | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` | Testnet WASM hash | byte/hash match; code-only |

The active frontend's local development verifier ID is an older localhost-pinned development instance. Repository deployment evidence identifies the production-pinned Testnet origin verifier above; no active Testnet env was changed during this task.

## Preparation validation

- Shell syntax, ShellCheck 0.10.0, and JSON parsing: PASS.
- Locked release artifacts and live Testnet byte/hash provenance: PASS for all six inspected artifacts. `contract info build` could not resolve the release attestation through CLI 26, so the workflow reports that limitation and relies on the locked release/tag provenance plus exact Testnet bytes; it does not silently call the result verified or audited.
- Contract formatting and tests: PASS, 82 tests and 0 failures. The current repository source also built successfully with the repository's CLI 27 workflow under the separately installed Rust 1.93 toolchain; that build output is not a deployment artifact.
- Backend validation and tests: PASS, 592 passed, 29 skipped, 0 failed.
- Frontend Biome, typecheck, tests, and Testnet build: PASS, 475 tests and 0 failures.
- Git history and deployment-allowlist secret scans with redaction: PASS; no secret is present in the preparation diff. Pre-existing ignored local environment data and generated target metadata remain outside the commit.
- Mainnet full preflight: expected fail-closed exit because the operator config and execution gates are absent. No Mainnet XDR was built, signed, or sent.
- CLI 26.1.0 transaction regression: PASS after correcting the preparation workflow. The tagged CLI source and a live Testnet reproduction confirmed that `--wasm-hash --build-only` fails and that `--build-only` is unsimulated raw XDR. The workflow now builds from the locked local WASM, asserts the embedded executable hash, and runs official `tx simulate`; artifact-only preflight exercises all four global create-contract paths without signing or sending.

## Safety disposition

- No Mainnet gate configuration file existed at preparation time.
- `MAINNET_RPC_URL`, `MAINNET_SOURCE_ACCOUNT`, `MAINNET_RP_ID`, `MAINNET_ALLOWED_ORIGINS_JSON`, `MAINNET_NETWORK_PASSPHRASE`, `EXECUTE_MAINNET_DEPLOY`, and `MAINNET_MAX_TOTAL_FEE_XLM` were all missing.
- No transaction was built, signed, or sent to Mainnet.
- Existing user changes in `fe/apps/web/index.html` and `be/docker-compose.local.override.yml` were preserved and excluded from staging.
- Testnet runtime configuration, Rust source, Docker, database, and deployment infrastructure were not modified.
