# Mainnet core deployment runbook

Status: **prepared, not deployed**. This runbook installs a dormant contract core; it does not move the public application, users, backend, database, workers, sponsor wallet, or funds off Testnet.

## Scope and dependency result

The required Mainnet set is:

1. upload `origin-verifier`, `web-auth`, `recovery-registry`, `spending-limit-policy`, and `smart-account`;
2. deploy one global instance for the first four contracts;
3. derive the native XLM SAC address without deploying it;
4. do not upload or deploy `verifier-ed25519`, because the passkey core has no fixed dependency on that optional cold-key verifier;
5. do not create a `smart-account` instance. User wallets are created only by the application rollout, which remains disabled on Mainnet.

`origin-verifier` is the only deployed global contract with a constructor. Its exact interface is `__constructor(rp_id_hash: BytesN<32>, allowed_origins: Vec<Bytes>)`. The other three global contracts have no constructor. `smart-account` has `__constructor(signers: Vec<Signer>, policies: Map<Address, Val>)`, which is precisely why this workflow uploads its WASM but never creates an instance.

The contracts do not contain fixed Testnet contract IDs. `recovery-registry` calls a wallet address supplied at runtime; `spending-limit-policy` is installed per account/rule; `web-auth` has no verifier-address constructor or state initialization.

## One-time toolchain

The deployment CLI is deliberately separate from any global Stellar CLI:

```bash
export STELLAR26="$HOME/.local/stellar-cli-26/bin/stellar"
cargo install --locked stellar-cli --version 26.1.0 --root "$HOME/.local/stellar-cli-26"
"$STELLAR26" --version
```

The preparation host could not compile the CLI because its native OpenSSL/DBus development packages require administrator access. The official `stellar-cli` v26.1.0 Linux binary was therefore installed at the same isolated path and its SHA-256 was checked against the release checksum (`e18d5a7629102e1ccc07241acbcbebfc05b1c02476ce7d3204ba2d7418be5c0c`). The observed version is `stellar 26.1.0 (1228cff8022b804659750b94b315932b0e0f3f6a)`. This fallback did not modify Cargo files or a global CLI.

The release WASMs were produced with `stellar-cli 27.0.0`, Rust `1.97.1`, and `soroban-sdk 26.1.1`; their environment metadata targets protocol 26. Deployment and inspection use CLI 26.1.0.

## Operator configuration

Create the ignored local file without printing it:

```bash
cp contracts/deployments/mainnet/.env.mainnet.example \
  contracts/deployments/mainnet/.env.mainnet.local
chmod 600 contracts/deployments/mainnet/.env.mainnet.local
```

Replace every placeholder. `MAINNET_SOURCE_ACCOUNT` must be an identity alias already stored by Stellar CLI, never an `S...` secret. `MAINNET_EXPECTED_GIT_SHA` must be the full preparation commit. The passphrase must be exactly:

```text
Public Global Stellar Network ; September 2015
```

`MAINNET_RP_ID`, `MAINNET_ALLOWED_ORIGINS_JSON`, and `MAINNET_PRODUCTION_EXTENSION_ID` must exactly match the reviewed production configuration in `artifacts.lock.json`. The lock is the same RP ID and ordered three-origin set returned by the production-pinned Testnet verifier's read-only `config` call. Validation also rejects localhost, loopback, Testnet, `pages.dev`, `vercel.app`, wildcard, unencrypted HTTP, and any other Chrome extension ID.

The release repository may require authentication. `gh auth status` must succeed when the artifact cache is empty. The scripts download only named assets from the tags in `artifacts.lock.json`, then check SHA-256, Soroban WASM hash, protocol, interface, metadata, and Testnet on-chain hash.

## Commands

Artifact-only preflight is safe without Mainnet credentials:

```bash
STELLAR26="$HOME/.local/stellar-cli-26/bin/stellar" \
  bash contracts/scripts/mainnet-preflight.sh --artifact-only
```

Full preflight makes RPC calls and simulations but sends no transaction:

```bash
bash contracts/scripts/mainnet-preflight.sh
```

If `EXECUTE_MAINNET_DEPLOY` is anything other than exact `YES`, stop here. With exact opt-in and every gate green:

```bash
bash contracts/scripts/mainnet-deploy.sh
bash contracts/scripts/mainnet-verify.sh
```

## Fee and transaction gates

Stellar CLI 26.1.0 has a documented implementation limitation in its own tagged source: `contract deploy --wasm-hash --build-only` refuses to fetch the remote interface and returns `WasmNotProvided`. Also, `--build-only` creates raw XDR; it does not simulate resources. The workflow handles both facts explicitly: it builds from the hash-locked local WASM, decodes the resulting operation to assert the embedded executable hash, and passes every raw XDR through the official `stellar tx simulate` command before fee inspection, signing, or sending.

Soroban cannot simulate `create_contract` on Mainnet until that code ledger entry exists there. The workflow therefore uses two fail-closed gates:

1. full preflight simulates every required upload on Mainnet and every global deployment read-only on live Testnet using identical locked bytes and constructor configuration. It verifies that the live Testnet protocol supports the artifacts' locked protocol-26 interface, records the actual simulation protocol, applies a fixed 2x safety factor to the combined estimate, and checks it against `MAINNET_MAX_TOTAL_FEE_XLM` before the first Mainnet transaction;
2. after byte-matched WASMs exist on Mainnet, the deploy script simulates every global instance again on Mainnet and checks exact upload-plus-deploy total against the same cap before the first instance transaction.

Every sent operation uses `--build-only` followed by `stellar tx simulate`, is signed by the CLI identity alias, hashed with `stellar tx hash`, sent with `stellar tx send`, and confirmed with `stellar tx fetch`. Signed XDR stays in the ignored `transactions/` directory. A pending transaction is written to the manifest before submission; on resume, a successful pending upload or deployment is recovered from its official receipt instead of creating a duplicate.

Uploads always use `--optimize=false`. A Mainnet code entry is accepted only when fetched bytes hash to the locked value. Instance XDR is built from the locked local WASM with `--optimize=false`, decoded to prove that the operation references the expected WASM hash, and then simulated. Native SAC uses only `contract id asset --asset native`.

## Evidence lifecycle

`manifest.template.json` is committed as the schema. `manifest.json` is created only when an authorized deployment actually starts, so the repository cannot mistake preparation for an on-chain deployment. The manifest records the live protocol and the literal whole-tree cleanliness result. Because the two pre-existing user paths are explicitly preserved, `git_tree_clean_at_deploy` may be `false` while `deployment_allowlist_clean` remains `true`; this is evidence, not an attempt to describe a dirty tree as clean. After deployment, commit the generated manifest, sanitized preflight/verification reports, and the completed `docs/MAINNET-EVIDENCE.md` in a separate evidence commit.

Explorer terms are kept distinct:

- `deployed`: the RPC returns the instance and its locked hash;
- `source-attested`: build/release provenance is available;
- `verified`: the explorer explicitly returns verified;
- `audited`: never implied by this workflow.

## Rollback boundary

There is no application cutover in this workflow, so no frontend/backend rollback is needed. A failed partial run leaves uploaded WASM dormant and keeps its transaction evidence. Do not delete progress, change bytecode, guess another constructor, or increase fees without a new reviewed budget. The public application continues on Testnet throughout.
