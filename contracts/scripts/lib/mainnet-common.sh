#!/usr/bin/env bash
# Shared, fail-closed helpers for the dormant Mainnet core deployment.
set -euo pipefail

MAINNET_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd -- "$MAINNET_SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_DIR="$REPO_ROOT/contracts/deployments/mainnet"
LOCK_FILE="$DEPLOYMENT_DIR/artifacts.lock.json"
# These paths are consumed by scripts that source this library.
# shellcheck disable=SC2034
MANIFEST_FILE="$DEPLOYMENT_DIR/manifest.json"
# shellcheck disable=SC2034
MANIFEST_TEMPLATE="$DEPLOYMENT_DIR/manifest.template.json"
ENV_FILE="${MAINNET_ENV_FILE:-$DEPLOYMENT_DIR/.env.mainnet.local}"
CACHE_DIR="$DEPLOYMENT_DIR/.cache"
ARTIFACT_DIR="$CACHE_DIR/artifacts"
CLI_CONFIG_DIR="$CACHE_DIR/stellar-config"
# shellcheck disable=SC2034
TX_DIR="$DEPLOYMENT_DIR/transactions"
# shellcheck disable=SC2034
PREFLIGHT_DIR="$DEPLOYMENT_DIR/preflight"
# shellcheck disable=SC2034
VERIFY_DIR="$DEPLOYMENT_DIR/verification"
STELLAR26="${STELLAR26:-$HOME/.local/stellar-cli-26/bin/stellar}"
MAINNET_PASSPHRASE='Public Global Stellar Network ; September 2015'

log() { printf '[mainnet] %s\n' "$*"; }
die() { printf '[mainnet] ERROR: %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

require_base_tools() {
  local command_name
  for command_name in git jq curl sha256sum cargo; do
    require_command "$command_name"
  done
  [[ -x "$STELLAR26" ]] || die "missing isolated Stellar CLI: $STELLAR26"
  [[ "$($STELLAR26 --version | head -n 1)" == stellar\ 26.1.0* ]] ||
    die 'isolated Stellar CLI must be exactly 26.1.0'
}

redact_rpc_url() {
  local url="$1"
  if [[ "$url" =~ ^(https://[^/:?#]+)(:[0-9]+)? ]]; then
    printf '%s%s/***REDACTED***\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]:-}"
  else
    printf 'INVALID-RPC-URL/***REDACTED***\n'
  fi
}

load_mainnet_env() {
  [[ -f "$ENV_FILE" ]] || return 2
  chmod 600 "$ENV_FILE"
  # This file is operator-owned and ignored by Git. Its values are never echoed.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

missing_gate_names() {
  local names=(
    MAINNET_RPC_URL MAINNET_SOURCE_ACCOUNT MAINNET_RP_ID
    MAINNET_ALLOWED_ORIGINS_JSON MAINNET_NETWORK_PASSPHRASE
    MAINNET_MAX_TOTAL_FEE_XLM MAINNET_EXPECTED_GIT_SHA
    MAINNET_NETWORK_NAME MAINNET_MIN_SOURCE_BALANCE_XLM
  )
  local name
  for name in "${names[@]}"; do
    [[ -n "${!name:-}" ]] || printf '%s\n' "$name"
  done
}

validate_git_state() {
  [[ "$(git -C "$REPO_ROOT" branch --show-current)" == main ]] || die 'deployment requires branch main'
  git -C "$REPO_ROOT" fetch --quiet origin main || die 'could not refresh origin/main'
  [[ "$(git -C "$REPO_ROOT" rev-parse HEAD)" == "$MAINNET_EXPECTED_GIT_SHA" ]] ||
    die 'HEAD does not match MAINNET_EXPECTED_GIT_SHA'
  [[ "$(git -C "$REPO_ROOT" rev-parse refs/remotes/origin/main)" == "$MAINNET_EXPECTED_GIT_SHA" ]] ||
    die 'origin/main diverges from MAINNET_EXPECTED_GIT_SHA'
  git -C "$REPO_ROOT" diff --quiet "$MAINNET_EXPECTED_GIT_SHA" -- \
    contracts/Cargo.toml contracts/Cargo.lock 'contracts/*/Cargo.toml' 'contracts/*/src' ||
    die 'contract source or dependency files differ from the expected commit'

  local line path unexpected=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"
    path="${path#\"}"; path="${path%\"}"
    case "$path" in
      fe/apps/web/index.html|be/docker-compose.local.override.yml|\
      contracts/deployments/mainnet/.env.mainnet.local|\
      contracts/deployments/mainnet/.cache/*|\
      contracts/deployments/mainnet/transactions/*|\
      contracts/deployments/mainnet/manifest.json|\
      contracts/deployments/mainnet/preflight/*|\
      contracts/deployments/mainnet/verification/*|\
      docs/MAINNET-EVIDENCE.md) ;;
      *) printf '[mainnet] unexpected working-tree path: %s\n' "$path" >&2; unexpected=1 ;;
    esac
  done < <(git -C "$REPO_ROOT" status --porcelain=v1 --untracked-files=all)
  [[ "$unexpected" == 0 ]] || die 'working tree contains paths outside the deployment allowlist'
}

validate_mainnet_config() {
  local locked_rp locked_origins supplied_origins locked_extension
  [[ "$MAINNET_NETWORK_PASSPHRASE" == "$MAINNET_PASSPHRASE" ]] || die 'incorrect Mainnet network passphrase'
  [[ "$MAINNET_SOURCE_ACCOUNT" =~ ^[A-Za-z][A-Za-z0-9_-]{2,63}$ ]] ||
    die 'MAINNET_SOURCE_ACCOUNT must be a CLI identity alias, not key material'
  [[ ! "$MAINNET_SOURCE_ACCOUNT" =~ ^[SGM] ]] || die 'MAINNET_SOURCE_ACCOUNT looks like key material/address, not an alias'
  [[ "$MAINNET_RPC_URL" == https://* ]] || die 'MAINNET_RPC_URL must use HTTPS'
  [[ "$MAINNET_MAX_TOTAL_FEE_XLM" =~ ^[0-9]+([.][0-9]{1,7})?$ ]] || die 'invalid MAINNET_MAX_TOTAL_FEE_XLM'
  [[ "${MAINNET_MIN_SOURCE_BALANCE_XLM:-}" =~ ^[0-9]+([.][0-9]{1,7})?$ ]] || die 'invalid MAINNET_MIN_SOURCE_BALANCE_XLM'
  awk -v balance="$MAINNET_MIN_SOURCE_BALANCE_XLM" -v budget="$MAINNET_MAX_TOTAL_FEE_XLM" 'BEGIN { exit !(balance >= budget) }' ||
    die 'MAINNET_MIN_SOURCE_BALANCE_XLM must be at least MAINNET_MAX_TOTAL_FEE_XLM'
  [[ "$MAINNET_NETWORK_NAME" =~ ^[A-Za-z][A-Za-z0-9_-]{2,63}$ ]] || die 'invalid MAINNET_NETWORK_NAME'
  [[ "${MAINNET_INCLUSION_FEE_STROOPS:-100}" =~ ^[0-9]+$ ]] || die 'invalid MAINNET_INCLUSION_FEE_STROOPS'

  [[ "$MAINNET_RP_ID" =~ ^[A-Za-z0-9.-]+$ ]] || die 'MAINNET_RP_ID must be a DNS name without scheme/path'
  [[ "$MAINNET_RP_ID" != *localhost* && "$MAINNET_RP_ID" != *testnet* && "$MAINNET_RP_ID" != *pages.dev* && "$MAINNET_RP_ID" != *vercel.app* ]] ||
    die 'development/test RP ID is forbidden'
  jq -e 'type == "array" and length > 0 and all(.[]; type == "string" and length > 0)' \
    <<<"$MAINNET_ALLOWED_ORIGINS_JSON" >/dev/null || die 'MAINNET_ALLOWED_ORIGINS_JSON must be a non-empty JSON string array'

  locked_rp="$(jq -r '.origin_config.rp_id' "$LOCK_FILE")"
  locked_origins="$(jq -c '.origin_config.allowed_origins' "$LOCK_FILE")"
  supplied_origins="$(jq -c . <<<"$MAINNET_ALLOWED_ORIGINS_JSON")"
  locked_extension="$(jq -r '.origin_config.production_extension_id' "$LOCK_FILE")"
  [[ "$MAINNET_RP_ID" == "$locked_rp" ]] || die 'MAINNET_RP_ID differs from the reviewed production lock'
  [[ "$supplied_origins" == "$locked_origins" ]] || die 'MAINNET_ALLOWED_ORIGINS_JSON differs from the reviewed production lock'
  [[ "${MAINNET_PRODUCTION_EXTENSION_ID:-}" == "$locked_extension" ]] ||
    die 'MAINNET_PRODUCTION_EXTENSION_ID differs from the reviewed production lock'

  local origin extension_id extension_count=0
  while IFS= read -r origin; do
    [[ "$origin" != *localhost* && "$origin" != *127.0.0.1* && "$origin" != *pages.dev* && "$origin" != *vercel.app* && "$origin" != *testnet* && "$origin" != *'*'* ]] ||
      die 'development, Testnet, or wildcard origin is forbidden'
    case "$origin" in
      https://*) ;;
      chrome-extension://*)
        extension_id="${origin#chrome-extension://}"
        [[ "$extension_id" =~ ^[a-p]{32}$ ]] || die 'invalid Chrome extension origin'
        [[ -n "${MAINNET_PRODUCTION_EXTENSION_ID:-}" && "$extension_id" == "$MAINNET_PRODUCTION_EXTENSION_ID" ]] ||
          die 'Chrome extension origin does not match MAINNET_PRODUCTION_EXTENSION_ID'
        extension_count=$((extension_count + 1))
        ;;
      android:apk-key-hash:*) ;;
      http://*) die 'unencrypted HTTP origin is forbidden' ;;
      *) die 'unsupported WebAuthn origin scheme' ;;
    esac
  done < <(jq -r '.[]' <<<"$MAINNET_ALLOWED_ORIGINS_JSON")
  [[ "$extension_count" -le 1 ]] || die 'duplicate Chrome extension origins are forbidden'
}

configure_isolated_network() {
  mkdir -p "$CLI_CONFIG_DIR"
  chmod 700 "$CLI_CONFIG_DIR"
  "$STELLAR26" --config-dir "$CLI_CONFIG_DIR" network rm "$MAINNET_NETWORK_NAME" >/dev/null 2>&1 || true
  "$STELLAR26" --config-dir "$CLI_CONFIG_DIR" network add "$MAINNET_NETWORK_NAME" \
    --rpc-url "$MAINNET_RPC_URL" --network-passphrase "$MAINNET_NETWORK_PASSPHRASE" >/dev/null
}

stellar_mainnet() {
  "$STELLAR26" --config-dir "$CLI_CONFIG_DIR" "$@" --network "$MAINNET_NETWORK_NAME"
}

artifact_path() {
  local key="$1"
  printf '%s/%s\n' "$ARTIFACT_DIR" "$(jq -r --arg key "$key" '.contracts[$key].asset' "$LOCK_FILE")"
}

download_artifact() {
  local key="$1" asset tag path
  asset="$(jq -r --arg key "$key" '.contracts[$key].asset' "$LOCK_FILE")"
  tag="$(jq -r --arg key "$key" '.contracts[$key].release_tag' "$LOCK_FILE")"
  path="$ARTIFACT_DIR/$asset"
  [[ -f "$path" ]] && return
  require_command gh
  log "downloading locked release artifact: $key"
  gh release download "$tag" --repo "$(jq -r '.artifact_repository' "$LOCK_FILE")" \
    --pattern "$asset" --dir "$ARTIFACT_DIR" --skip-existing >/dev/null
}

verify_local_artifact() {
  local key="$1" path expected_sha expected_hash actual_sha actual_hash protocol meta_json
  local rustc_meta sdk_meta cli_meta repo_meta source_commit_count
  path="$(artifact_path "$key")"
  expected_sha="$(jq -r --arg key "$key" '.contracts[$key].artifact_sha256' "$LOCK_FILE")"
  expected_hash="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  actual_sha="$(sha256sum "$path" | awk '{print $1}')"
  actual_hash="$($STELLAR26 contract info hash --wasm "$path")"
  [[ "$actual_sha" == "$expected_sha" && "$actual_hash" == "$expected_hash" ]] || die "artifact hash mismatch: $key"
  protocol="$($STELLAR26 contract info env-meta --wasm "$path" --output json | jq -r '.[0].sc_env_meta_kind_interface_version.protocol // empty')"
  [[ "$protocol" == "$(jq -r '.wasm_protocol' "$LOCK_FILE")" ]] || die "artifact protocol is not locked: $key"
  "$STELLAR26" contract info interface --wasm "$path" --output json >/dev/null
  meta_json="$($STELLAR26 contract info meta --wasm "$path" --output json)"
  rustc_meta="$(jq -r '.[] | select(.sc_meta_v0.key == "rsver") | .sc_meta_v0.val' <<<"$meta_json")"
  sdk_meta="$(jq -r '.[] | select(.sc_meta_v0.key == "rssdkver") | .sc_meta_v0.val' <<<"$meta_json")"
  cli_meta="$(jq -r '.[] | select(.sc_meta_v0.key == "cliver") | .sc_meta_v0.val' <<<"$meta_json")"
  repo_meta="$(jq -r '.[] | select(.sc_meta_v0.key == "source_repo") | .sc_meta_v0.val' <<<"$meta_json")"
  source_commit_count="$(jq '[.[] | select(.sc_meta_v0.key == "source_repo_commit")] | length' <<<"$meta_json")"
  [[ "$rustc_meta" == "$(jq -r '.artifact_metadata.rustc' "$LOCK_FILE")" ]] || die "unexpected Rust metadata: $key"
  [[ "$sdk_meta" == "$(jq -r '.artifact_metadata.soroban_sdk' "$LOCK_FILE")" ]] || die "unexpected SDK metadata: $key"
  [[ "$cli_meta" == "$(jq -r '.artifact_metadata.stellar_cli' "$LOCK_FILE")" ]] || die "unexpected CLI metadata: $key"
  [[ "$repo_meta" == "$(jq -r '.artifact_metadata.source_repo' "$LOCK_FILE")" ]] || die "unexpected source_repo metadata: $key"
  [[ "$source_commit_count" == 0 && "$(jq -r '.artifact_metadata.source_repo_commit_present' "$LOCK_FILE")" == false ]] ||
    die "unexpected source_repo_commit metadata: $key"
  if ! "$STELLAR26" contract info build --wasm "$path" >/dev/null 2>&1; then
    log "build attestation lookup unavailable; locked release/Testnet bytes remain authoritative: $key"
  fi
}

prepare_and_verify_artifacts() {
  mkdir -p "$ARTIFACT_DIR"
  chmod 700 "$CACHE_DIR" "$ARTIFACT_DIR"
  local key
  while IFS= read -r key; do
    download_artifact "$key"
    verify_local_artifact "$key"
  done < <(jq -r '.contracts | keys[]' "$LOCK_FILE")
}

verify_testnet_provenance() {
  local key contract_id expected_hash chain_hash path fresh fetched_hash
  while IFS= read -r key; do
    expected_hash="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
    contract_id="$(jq -r --arg key "$key" '.contracts[$key].testnet_contract_id // empty' "$LOCK_FILE")"
    if [[ -n "$contract_id" ]]; then
      chain_hash="$($STELLAR26 contract info hash --contract-id "$contract_id" --network testnet)"
      [[ "$chain_hash" == "$expected_hash" ]] || die "Testnet on-chain hash mismatch: $key"
    else
      path="$CACHE_DIR/testnet-$key.wasm"
      fresh="$CACHE_DIR/.testnet-$key.$$.$RANDOM.wasm"
      if "$STELLAR26" contract fetch --wasm-hash "$expected_hash" --network testnet --out-file "$fresh"; then
        mv -- "$fresh" "$path"
      else
        rm -f -- "$fresh"
        die "Testnet WASM is not retrievable: $key"
      fi
      fetched_hash="$(sha256sum "$path" | awk '{print $1}')"
      [[ "$fetched_hash" == "$expected_hash" ]] || die "Testnet WASM fetch mismatch: $key"
    fi
  done < <(jq -r '.contracts | keys[]' "$LOCK_FILE")
}

origin_constructor_values() {
  local rp_id="${1:-${MAINNET_RP_ID:-}}" allowed_origins_json="${2:-${MAINNET_ALLOWED_ORIGINS_JSON:-}}"
  [[ -n "$rp_id" && -n "$allowed_origins_json" ]] || die 'origin constructor configuration is missing'
  ORIGIN_RP_HASH="$(printf '%s' "$rp_id" | sha256sum | awk '{print $1}')"
  ORIGIN_BYTES_JSON="$({
    while IFS= read -r origin; do
      printf '%s' "$origin" | od -An -tx1 | tr -d ' \n'
      printf '\n'
    done < <(jq -r '.[]' <<<"$allowed_origins_json")
  } | jq -Rsc 'split("\n") | map(select(length > 0))')"
  ORIGIN_ARGS_SHA="$(jq -cnS --arg rp "$ORIGIN_RP_HASH" --argjson origins "$ORIGIN_BYTES_JSON" \
    '{rp_id_hash:$rp,allowed_origins:$origins}' | sha256sum | awk '{print $1}')"
  export ORIGIN_RP_HASH ORIGIN_BYTES_JSON ORIGIN_ARGS_SHA
}

xdr_fee_stroops() {
  "$STELLAR26" tx decode "$1" --output json | jq -r '[.. | objects | .fee? | select(type == "number")] | max // 0'
}

assert_simulated_soroban_xdr() {
  local xdr="$1"
  "$STELLAR26" tx decode "$xdr" --output json |
    jq -e '.tx.tx.ext.v1.resources' >/dev/null || die 'transaction XDR has not been simulated'
}

assert_create_xdr_wasm_hash() {
  local xdr="$1" expected_hash="$2"
  "$STELLAR26" tx decode "$xdr" --output json |
    jq -e --arg expected "$expected_hash" \
      '[.. | objects | .executable?.wasm? // empty | select(. == $expected)] | length > 0' >/dev/null ||
    die "create-contract XDR does not embed the locked WASM hash: $expected_hash"
}

simulate_mainnet_xdr() {
  local source_account="$1" raw_xdr="$2" simulated
  simulated="$(printf '%s' "$raw_xdr" | stellar_mainnet tx simulate --source-account "$source_account")"
  assert_simulated_soroban_xdr "$simulated"
  printf '%s\n' "$simulated"
}

# CLI 26.1.0 deliberately cannot combine --wasm-hash with --build-only because
# that path refuses to fetch the remote interface. Using the locked local WASM
# with --build-only does not upload or optimize it: CLI source computes its hash
# and creates an operation whose executable is that hash. Decode checks below
# make that invariant explicit before official tx simulation.
estimate_testnet_deploy_fees() {
  local source protocol artifact_protocol key wasm expected_hash salt raw_xdr simulated fee total=0 costs='[]'
  source="$(jq -r '.testnet_simulation.source_public_key' "$LOCK_FILE")"
  [[ "$source" =~ ^G[A-Z2-7]{55}$ ]] || die 'invalid locked Testnet simulation public key'
  protocol="$($STELLAR26 network info --network testnet --output json | jq -r '.protocol_version')"
  artifact_protocol="$(jq -r '.wasm_protocol' "$LOCK_FILE")"
  [[ "$protocol" =~ ^[0-9]+$ && "$protocol" -ge "$artifact_protocol" ]] ||
    die 'live Testnet protocol is incompatible with the locked artifacts'
  "$STELLAR26" ledger entry fetch account --account "$source" --network testnet --output json >/dev/null ||
    die 'locked read-only Testnet simulation account is unavailable'

  while IFS= read -r key; do
    wasm="$(artifact_path "$key")"
    expected_hash="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
    salt="$(printf 'family-wallet-mainnet-preflight:%s:%s:%s' "$key" "$$" "$(date +%s%N)" | sha256sum | awk '{print $1}')"
    if [[ "$key" == origin_verifier ]]; then
      raw_xdr="$("$STELLAR26" contract deploy --network testnet --source-account "$source" \
        --wasm "$wasm" --optimize=false --salt "$salt" \
        --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only -- \
        --rp_id_hash "$ORIGIN_RP_HASH" --allowed_origins "$ORIGIN_BYTES_JSON")"
    else
      raw_xdr="$("$STELLAR26" contract deploy --network testnet --source-account "$source" \
        --wasm "$wasm" --optimize=false --salt "$salt" \
        --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
    fi
    assert_create_xdr_wasm_hash "$raw_xdr" "$expected_hash"
    simulated="$(printf '%s' "$raw_xdr" | "$STELLAR26" tx simulate --network testnet --source-account "$source")"
    assert_simulated_soroban_xdr "$simulated"
    assert_create_xdr_wasm_hash "$simulated" "$expected_hash"
    fee="$(xdr_fee_stroops "$simulated")"
    [[ "$fee" =~ ^[0-9]+$ && "$fee" -gt 100 ]] || die "invalid Testnet deploy simulation fee: $key"
    total=$((total + fee))
    costs="$(jq -cn --argjson old "$costs" --arg name "$key" --argjson fee "$fee" --argjson protocol "$protocol" \
      '$old + [{type:"deploy",contract:$name,fee_stroops:$fee,estimate_network:"testnet",estimate_protocol:$protocol,transaction_sent:false}]')"
  done < <(jq -r '.contracts | to_entries[] | select(.value.required == true and .value.deploy_instance == true) | .key' "$LOCK_FILE")

  TESTNET_DEPLOY_ESTIMATED_STROOPS="$total"
  TESTNET_DEPLOY_COSTS_JSON="$costs"
  TESTNET_SIMULATION_PROTOCOL="$protocol"
  export TESTNET_DEPLOY_ESTIMATED_STROOPS TESTNET_DEPLOY_COSTS_JSON TESTNET_SIMULATION_PROTOCOL
}

stroops_to_xlm() {
  awk -v value="$1" 'BEGIN { printf "%.7f", value / 10000000 }'
}

json_atomic_write() {
  local target="$1" tmp
  tmp="$(mktemp "$DEPLOYMENT_DIR/.manifest.tmp.XXXXXX")"
  jq . >"$tmp"
  mv -- "$tmp" "$target"
}

network_id() {
  printf '%s' "$MAINNET_PASSPHRASE" | sha256sum | awk '{print $1}'
}
