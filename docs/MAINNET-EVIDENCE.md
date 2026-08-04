# Mainnet core deployment evidence

Status: **DEPLOYED AND VERIFIED**
Verified: 2026-08-04T14:44:18Z
Application runtime: **Stellar Testnet**

> Family Wallet’s core Soroban contracts have been deployed on Stellar Mainnet. The public application continues to operate on Testnet during security hardening and staged production rollout.

## Scope

| Component | Status |
|---|---|
| Four global core contract instances | Deployed and hash-verified on Mainnet |
| Smart-account code | WASM present and hash-verified; no global or user instance |
| Native XLM SAC | Derived only; no custom deployment |
| Optional verifier-ed25519 | Not required and not deployed |
| Public frontend and backend | Continue to use Testnet |
| Existing users, wallets, funds, database and workers | Not migrated |
| Mainnet user onboarding or canary wallet | Not created in this deployment |

This evidence proves deployment state, executable hashes and the locked constructor configuration. It does not claim that the contracts or application have been audited, and it does not describe a fully launched production application.

## Network and provenance

| Field | Value |
|---|---|
| Network | Stellar Mainnet (`Public Global Stellar Network ; September 2015`) |
| Network ID / passphrase SHA-256 | `7ac33997544e3175d266bd022439b22cdb16508c01163f26e5cb2a3e1045a979` |
| Protocol at deployment | 27 |
| Public deployer | `GBIDNHWY2Q522ATTYX2VIQWTEZFXJLMNQMDJVALRGPJPSSGCBIPYZY7E` |
| Repository | `https://github.com/msci2026vn/family-wallet` |
| Locked deployment-source commit retained by manifest | `9023f7971a4d2e9d43bf9b014535f8eca89bbaa6` |
| Origin deploy transaction tooling commit | `5295c77b4e1427d43254a727559e13c394a42d52` |
| Remaining deploy transaction tooling commit | `b4ec31883a9b79c047ece1e510736e1561b4772a` |
| Final verification tooling commit | `9a0c936afddcc024776582ab10f718c9f5289460` |
| Artifact lock SHA-256 | `5efc00d0393ad6d1003b49097ea67a89992995f31b12eb5129a9eabf61676b29` |
| Cargo.lock SHA-256 | `fd2a8521329a32447078b4b10402248927688d428074713398abf7c49133e2d7` |
| Deployment/inspection CLI | `stellar 26.1.0 (1228cff8022b804659750b94b315932b0e0f3f6a)` |
| Locked artifact toolchain | Stellar CLI 27.0.0; Rust 1.97.1; soroban-sdk 26.1.1 |
| Host evidence toolchain | rustc 1.91.0; cargo 1.91.0 |

The manifest retains its historical `.source.git_commit`; tooling commits made during safe resume are recorded per transaction and were not substituted into historical deployment provenance.

## Mainnet WASM uploads

All five code entries were fetched from Mainnet and SHA-256 checked before instance deployment. The deployment script byte-checked and skipped every upload.

| Contract | Locked/Mainnet WASM hash | Upload transaction | Ledger | Status |
|---|---|---|---:|---|
| origin-verifier | `5f41462676ef708519915f79367292c8bff6a3d2894931a5d1638a29748886a8` | `2fb4236b098c2f3356eb956beeed923573af27050786a0df25d3f211916c70f3` | 63793443 | SUCCESS |
| web-auth | `4c0ad10d38ac7ee0c0c842dc4bd897d467f61420f79731639950735b04aaa524` | `365017e27265bb70f995ac5e4092280740337d8adb765abe5e8e9798af5f149c` | 63795260 | SUCCESS |
| recovery-registry | `f45bbdb3fa2682fb2d1f3314de7924edf7eefab79dff3c602897742b928a4d26` | `1bbc77cffbe7f0d96330a4a061971e8ae1f40d536be08ad71db9fd69aa633fcd` | 63795262 | SUCCESS |
| spending-limit-policy | `13fab007bba18c6ad42d28818126dd1c403cf7fda6319faf71b55b4ec4b44a55` | `8ad7a091eb33e0de747648f5d93fd7775d73b47cec53a44c8181c253828f8ee0` | 63795264 | SUCCESS |
| smart-account | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` | `8e5522aa464e1713c6fc5594959d92c274482fc2538aca45b4060331dffefda6` | 63795267 | SUCCESS |

The abandoned transaction `cee5a5527386290ba03a5bb2d692a59215c8bb61edcdf99841078adbbebd8701` remains preserved in the manifest as `abandoned_not_in_ledger`; it was not resubmitted.

## Verified global instances

| Contract | Mainnet contract ID | Deploy transaction | Ledger | Executable hash | Constructor args SHA-256 | Explorer |
|---|---|---|---:|---|---|---|
| origin-verifier | `CD2ESBAKCSTPUJANAYZJ5YEOMTK7GMISBRECR2RP2SWL2RSBESAGQE7J` | `3c545608d9e06853aa9099de20728ad19fb621d655fbbb25fc9ccf32c32efc20` | 63796367 | `5f41462676ef708519915f79367292c8bff6a3d2894931a5d1638a29748886a8` | `959f50b81bdffcdf1e9a7f3ae57307313f6d970a294b03e7f7c8d7627b1749fb` | [verified](https://stellar.expert/explorer/public/contract/CD2ESBAKCSTPUJANAYZJ5YEOMTK7GMISBRECR2RP2SWL2RSBESAGQE7J) |
| web-auth | `CCKXCJHQ5ZINR4V7H7FTH2G4KI2FNVX4I6LHMMHIFQMKXMFTCAGRU3RY` | `94477a25c8fdca7c4bf3dc5036375dd702492ef6b261f91ed3c9b59e7747d86a` | 63796497 | `4c0ad10d38ac7ee0c0c842dc4bd897d467f61420f79731639950735b04aaa524` | no constructor | [verified](https://stellar.expert/explorer/public/contract/CCKXCJHQ5ZINR4V7H7FTH2G4KI2FNVX4I6LHMMHIFQMKXMFTCAGRU3RY) |
| recovery-registry | `CDVX3E3PV4TE5HAHSFS4R3YHOB5SLCYU2KQWO5GCZDV2TPQUZ66SLJMH` | `c055e68a883baf14435da26f36bcc0ac631ca1dd8897597e7498510e4d74cb32` | 63796500 | `f45bbdb3fa2682fb2d1f3314de7924edf7eefab79dff3c602897742b928a4d26` | no constructor | [verified](https://stellar.expert/explorer/public/contract/CDVX3E3PV4TE5HAHSFS4R3YHOB5SLCYU2KQWO5GCZDV2TPQUZ66SLJMH) |
| spending-limit-policy | `CAL3TR34D6FY6ZLQNJGHLIX4LUWU277V2CHAVEUL4X2DNOJXMV6TK45W` | `1ba1f214be709d095032b4eea25309767ce36e280e435ab458d2d6f72fd80432` | 63796503 | `13fab007bba18c6ad42d28818126dd1c403cf7fda6319faf71b55b4ec4b44a55` | no constructor | [verified](https://stellar.expert/explorer/public/contract/CAL3TR34D6FY6ZLQNJGHLIX4LUWU277V2CHAVEUL4X2DNOJXMV6TK45W) |

RPC `getTransaction` and Horizon both returned successful final status for all four deploy transactions. `mainnet-verify.sh` independently read each on-chain executable hash, and a `--send=no` call confirmed the origin-verifier config digest `6e4c7c14debe82c7ce985e22bc5a4ae54aa5e837832ea5ab720ecf3fbf75124d` against the reviewed constructor lock. Stellar Expert reported `verified` for all four instances. Build-attestation lookup through the CLI was unavailable and is not represented as an audit result.

## Code-only and native contracts

- Smart-account remains `global_instance=false`, `contract_id=null`, status `wasm_verified`. No constructor was invoked and no Mainnet user wallet was created.
- verifier-ed25519 remains `required=false`, status `not_required`; it was neither uploaded in this run nor deployed as an instance.
- Native XLM SAC was derived as `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`. No custom SAC deployment transaction exists.

## Fees and balance

| Measurement | XLM |
|---|---:|
| Source balance immediately before the four instance transactions | 224.8842450 |
| Source balance after the four instance transactions | 224.7667734 |
| Actual fee charged for the four instance transactions | 0.1174716 |
| Actual fee charged for the five earlier upload transactions | 91.7787550 |
| Actual fee charged for all nine recorded successful transactions | 91.8962266 |
| Cumulative XDR fee ceiling used by the second deployment gate | 102.7605729 |
| Configured total cap | 220.0000000 |

Actual fees are the sum of Horizon `fee_charged`; the instance-phase total also equals the observed balance delta. The preflight raw estimate was `0.0737585 XLM`, the mandatory 2× guarded estimate was `0.1475170 XLM`, and preflight exit code was `0`.

## Read-only reproduction

The following commands query or verify only; they do not sign or submit transactions:

```bash
bash contracts/scripts/mainnet-preflight.sh --artifact-only
bash contracts/scripts/mainnet-verify.sh

stellar contract info hash \
  --network family-mainnet \
  --contract-id <CONTRACT_ID>

stellar contract fetch \
  --network family-mainnet \
  --wasm-hash <WASM_HASH> \
  --out-file /tmp/contract.wasm
sha256sum /tmp/contract.wasm

curl -fsS https://mainnet.sorobanrpc.com \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":{"hash":"<TX_HASH>"}}'
```

No seed, private key, identity file content, password, signed XDR or operator environment is included in this evidence.
