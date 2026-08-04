#!/usr/bin/env bash
# Upload the locked core WASMs and deploy only the four global contract instances.
# This script never creates a smart-account instance and never deploys native SAC.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/mainnet-common.sh"

load_mainnet_env || die "missing operator config: $ENV_FILE"
[[ "${EXECUTE_MAINNET_DEPLOY:-NO}" == YES ]] || die 'EXECUTE_MAINNET_DEPLOY must equal YES exactly'

# Full preflight includes provenance, Git, origin, identity, balance, RPC, and upload fee gates.
"$SCRIPT_DIR/mainnet-preflight.sh" full

# Mainnet commands below need an RPC URL; do not export the passphrase globally.
export STELLAR_RPC_URL="$MAINNET_RPC_URL"
export STELLAR_NETWORK_PASSPHRASE="$MAINNET_NETWORK_PASSPHRASE"
configure_isolated_network
origin_constructor_values
mkdir -p "$TX_DIR" "$PREFLIGHT_DIR" "$VERIFY_DIR" "$CACHE_DIR/salts"

deployer_public="$($STELLAR26 keys public-key "$MAINNET_SOURCE_ACCOUNT")"
cli_version="$($STELLAR26 --version | head -n 1)"
git_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
cargo_lock_sha="$(sha256sum "$REPO_ROOT/contracts/Cargo.lock" | awk '{print $1}')"
live_protocol="$(stellar_mainnet network info --output json | jq -r '.protocol_version')"
[[ "$live_protocol" =~ ^[0-9]+$ && "$live_protocol" -ge 26 ]] || die 'invalid live Mainnet protocol'
git_tree_clean=false
[[ -z "$(git -C "$REPO_ROOT" status --porcelain=v1 --untracked-files=all)" ]] && git_tree_clean=true

if [[ ! -f "$MANIFEST_FILE" ]]; then
  jq \
    --arg git_sha "$git_sha" --arg rpc "$(redact_rpc_url "$MAINNET_RPC_URL")" \
    --arg network_id "$(network_id)" --arg public_key "$deployer_public" \
    --arg stellar_cli "$cli_version" --arg rustc "$(rustc --version)" --arg cargo "$(cargo --version)" \
    --arg cargo_lock_sha "$cargo_lock_sha" --arg max_fee "$MAINNET_MAX_TOTAL_FEE_XLM" \
    --argjson protocol "$live_protocol" --argjson git_clean "$git_tree_clean" \
    '.status="in_progress" | .network.rpc_host_redacted=$rpc | .network.network_id=$network_id |
     .network.protocol=$protocol | .source.git_commit=$git_sha | .source.git_tree_clean_at_deploy=$git_clean |
     .source.deployment_allowlist_clean=true |
     .toolchain.stellar_cli=$stellar_cli | .toolchain.rustc=$rustc | .toolchain.cargo=$cargo |
     .toolchain.cargo_lock_sha256=$cargo_lock_sha | .deployer_public_key=$public_key |
     .fee_budget.maximum_xlm=$max_fee' "$MANIFEST_TEMPLATE" | json_atomic_write "$MANIFEST_FILE"
fi

manifest_git_sha="$(jq -r '.source.git_commit // empty' "$MANIFEST_FILE")"
[[ "$manifest_git_sha" =~ ^[0-9a-f]{40}$ ]] || die 'manifest contains an invalid Git commit'
git -C "$REPO_ROOT" cat-file -e "$manifest_git_sha^{commit}" 2>/dev/null ||
  die 'manifest Git commit is unavailable locally'
git -C "$REPO_ROOT" merge-base --is-ancestor "$manifest_git_sha" "$git_sha" ||
  die 'manifest Git commit is not an ancestor of the deployment commit'
git -C "$REPO_ROOT" diff --quiet "$manifest_git_sha" "$git_sha" -- \
  contracts/Cargo.toml contracts/Cargo.lock 'contracts/*/Cargo.toml' 'contracts/*/src' \
  contracts/deployments/mainnet/artifacts.lock.json \
  contracts/deployments/mainnet/manifest.template.json ||
  die 'locked deployment inputs changed since the manifest was created'
[[ "$(jq -r '.network.network_id' "$MANIFEST_FILE")" == "$(network_id)" ]] || die 'manifest belongs to another network'

append_pending_tx() {
  local type="$1" key="$2" tx_hash="$3" artifact_sha="$4" wasm_hash="$5" constructor_sha="$6" fee_stroops="$7"
  jq --arg type "$type" --arg key "$key" --arg tx "$tx_hash" --arg source "$deployer_public" \
    --arg artifact "$artifact_sha" --arg wasm "$wasm_hash" --arg git "$git_sha" \
    --arg cli "$cli_version" --arg constructor "$constructor_sha" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson fee "$fee_stroops" \
    --arg rustc "$(rustc --version)" --arg cargo "$(cargo --version)" --arg cargo_lock "$cargo_lock_sha" \
    '.transactions += [{type:$type,contract:$key,artifact_sha256:$artifact,wasm_hash:$wasm,
      contract_id:null,source_public_key:$source,transaction_hash:$tx,ledger:null,timestamp_utc:$at,
      network_id:(.network.network_id),git_sha:$git,stellar_cli:$cli,
      rustc:$rustc,cargo:$cargo,cargo_lock_sha256:$cargo_lock,
      constructor_args_sha256:(if $constructor == "" then null else $constructor end),fee_stroops:$fee,status:"pending"}]' \
    "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
}

fetch_success_receipt() {
  local tx_hash="$1" response="" status="" request=""

  request="$(jq -cn --arg hash "$tx_hash" \
    '{jsonrpc:"2.0",id:1,method:"getTransaction",params:{hash:$hash}}')"

  # Chờ tối đa 5 phút vì RPC có thể index chậm hơn lúc ledger đóng.
  for _ in $(seq 1 60); do
    response="$(curl -fsS -X POST "$MAINNET_RPC_URL" \
      -H "Content-Type: application/json" \
      --data "$request" 2>/dev/null || true)"

    status="$(jq -r '.result.status // empty' <<<"$response" 2>/dev/null || true)"

    case "$status" in
      SUCCESS)
        jq -c '.result' <<<"$response"
        return 0
        ;;
      FAILED)
        jq -c '.result' <<<"$response" >&2
        return 1
        ;;
      NOT_FOUND|PENDING|"")
        sleep 5
        ;;
      *)
        sleep 5
        ;;
    esac
  done

  return 1
}

send_unsigned_xdr() {
  local type="$1" key="$2" unsigned="$3" artifact_sha="$4" wasm_hash="$5" constructor_sha="$6"
  local signed tx_hash signed_file receipt ledger fee_stroops successful_stroops prospective_stroops max_stroops
  fee_stroops="$(xdr_fee_stroops "$unsigned")"
  successful_stroops="$(jq '[.transactions[] | select(.status == "success") | .fee_stroops] | add // 0' "$MANIFEST_FILE")"
  max_stroops="$(awk -v value="$MAINNET_MAX_TOTAL_FEE_XLM" 'BEGIN { printf "%.0f", value * 10000000 }')"
  prospective_stroops=$((successful_stroops + fee_stroops))
  ((prospective_stroops <= max_stroops)) || die "actual cumulative fee would exceed MAINNET_MAX_TOTAL_FEE_XLM before $type: $key"
  signed="$($STELLAR26 tx sign "$unsigned" --network-passphrase "$MAINNET_PASSPHRASE" \
    --sign-with-key "$MAINNET_SOURCE_ACCOUNT" --auto-sign)"
  tx_hash="$($STELLAR26 tx hash "$signed" --network-passphrase "$MAINNET_PASSPHRASE")"
  signed_file="$TX_DIR/${type}-${key}-${tx_hash}.signed.xdr"
  printf '%s\n' "$signed" >"$signed_file"
  append_pending_tx "$type" "$key" "$tx_hash" "$artifact_sha" "$wasm_hash" "$constructor_sha" "$fee_stroops"
  log "sending $type for $key; tx=$tx_hash"
  printf '%s' "$signed" | stellar_mainnet tx send >/dev/null
  receipt="$(fetch_success_receipt "$tx_hash")" || die "transaction did not reach SUCCESS: $tx_hash"
  ledger="$(jq -r '.ledger // .ledgerSequence // .latestLedger // empty' <<<"$receipt")"
  [[ "$ledger" =~ ^[0-9]+$ ]] || ledger=null
  jq --arg tx "$tx_hash" --argjson ledger "$ledger" \
    '(.transactions[] | select(.transaction_hash == $tx)) |= (.status="success" | .ledger=$ledger)' \
    "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
  SEND_TX_HASH="$tx_hash"
  SEND_LEDGER="$ledger"
  SEND_RECEIPT="$receipt"
  # Keep the potentially large Soroban receipt shell-local.
  export SEND_TX_HASH SEND_LEDGER
  export -n SEND_RECEIPT
}

code_exists_with_hash() {
  local hash="$1" fetched fresh
  fetched="$CACHE_DIR/onchain-$hash.wasm"
  fresh="$CACHE_DIR/.onchain-$hash.$$.$RANDOM.wasm"
  if stellar_mainnet contract fetch --wasm-hash "$hash" --out-file "$fresh" >/dev/null 2>&1; then
    [[ "$(sha256sum "$fresh" | awk '{print $1}')" == "$hash" ]] || die "Mainnet returned different WASM bytes for $hash"
    mv -- "$fresh" "$fetched"
    return 0
  fi
  rm -f -- "$fresh"
  return 1
}

record_deployed_contract() {
  local key="$1" constructor_sha="$2" expected contract_id events
  expected="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  contract_id="$(jq -r '.. | strings | select(test("^C[A-Z2-7]{55}$"))' <<<"$SEND_RECEIPT" | sort -u | head -n 1)"
  if [[ -z "$contract_id" ]]; then
    events="$(stellar_mainnet tx fetch events --hash "$SEND_TX_HASH" --output json)"
    contract_id="$(jq -r '.. | strings | select(test("^C[A-Z2-7]{55}$"))' <<<"$events" | sort -u | head -n 1)"
  fi
  [[ "$contract_id" =~ ^C[A-Z2-7]{55}$ ]] || die "could not obtain contract ID from official transaction result: $key"
  [[ "$(stellar_mainnet contract info hash --contract-id "$contract_id")" == "$expected" ]] || die "deployed contract hash mismatch: $key"
  stellar_mainnet contract alias add --overwrite --id "$contract_id" "mainnet-$key" >/dev/null
  jq --arg key "$key" --arg id "$contract_id" --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" --arg constructor "$constructor_sha" \
    '.contracts[$key] += {contract_id:$id,deploy_tx_hash:$tx,deploy_ledger:$ledger,
      constructor_args_sha256:(if $constructor == "" then null else $constructor end),status:"deployed"} |
     (.transactions[] | select(.transaction_hash == $tx)) |= (.contract_id=$id)' \
    "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
}

# Phase 1: all required WASMs are installed before any instance is created.
while IFS= read -r key; do
  wasm="$(artifact_path "$key")"
  wasm_hash="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  artifact_sha="$(jq -r --arg key "$key" '.contracts[$key].artifact_sha256' "$LOCK_FILE")"
  recorded_upload_tx="$(jq -r --arg key "$key" '.contracts[$key].upload_tx_hash // empty' "$MANIFEST_FILE")"
  pending_tx=''
  if [[ -z "$recorded_upload_tx" ]]; then
    pending_tx="$(jq -r --arg key "$key" '[.transactions[] | select(.contract == $key and .type == "upload" and (.status == "pending" or .status == "success"))][-1].transaction_hash // empty' "$MANIFEST_FILE")"
  fi
  if [[ -n "$pending_tx" ]]; then
    SEND_RECEIPT="$(fetch_success_receipt "$pending_tx")" || die "pending upload transaction needs operator review before resume: $pending_tx"
    SEND_TX_HASH="$pending_tx"
    SEND_LEDGER="$(jq -r '.ledger // .ledgerSequence // .latestLedger // empty' <<<"$SEND_RECEIPT")"
    [[ "$SEND_LEDGER" =~ ^[0-9]+$ ]] || SEND_LEDGER=null
    jq --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" \
      '(.transactions[] | select(.transaction_hash == $tx)) |= (.status="success" | .ledger=$ledger)' \
      "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
    code_exists_with_hash "$wasm_hash" || die "recovered upload is not retrievable by locked hash: $key"
    jq --arg key "$key" --arg artifact "$artifact_sha" --arg wasm "$wasm_hash" --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" \
      '.contracts[$key] += {artifact_sha256:$artifact,wasm_hash:$wasm,upload_tx_hash:$tx,upload_ledger:$ledger,status:"wasm_uploaded"}' \
      "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
    log "recovered successful pending upload: $key; tx=$SEND_TX_HASH"
    continue
  fi
  if code_exists_with_hash "$wasm_hash"; then
    log "WASM already present and byte-matched; skipping upload: $key"
    jq --arg key "$key" --arg artifact "$artifact_sha" --arg wasm "$wasm_hash" \
      '.contracts[$key] += {artifact_sha256:$artifact,wasm_hash:$wasm,status:"wasm_available",upload_tx_hash:(.contracts[$key].upload_tx_hash // null)}' \
      "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
    continue
  fi
  raw_unsigned="$(stellar_mainnet contract upload --source-account "$deployer_public" --wasm "$wasm" \
    --optimize=false --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
  unsigned="$(simulate_mainnet_xdr "$deployer_public" "$raw_unsigned")"
  send_unsigned_xdr upload "$key" "$unsigned" "$artifact_sha" "$wasm_hash" ''
  code_exists_with_hash "$wasm_hash" || die "uploaded WASM is not retrievable by locked hash: $key"
  jq --arg key "$key" --arg artifact "$artifact_sha" --arg wasm "$wasm_hash" --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" \
    '.contracts[$key] += {artifact_sha256:$artifact,wasm_hash:$wasm,upload_tx_hash:$tx,upload_ledger:$ledger,status:"wasm_uploaded"}' \
    "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true) | .key' "$LOCK_FILE")

# Derivation only. No asset deployment transaction exists or is sent.
sac_native="$(stellar_mainnet contract id asset --asset native)"
[[ "$sac_native" =~ ^C[A-Z2-7]{55}$ ]] || die 'failed to derive native Mainnet SAC address'
jq --arg id "$sac_native" '.contracts.sac_native += {contract_id:$id,status:"derived"}' "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"

# Recover a deploy that reached SUCCESS before a previous process could persist its
# contract ID. This must happen before simulation because the stable salt is now used.
while IFS= read -r key; do
  existing_id="$(jq -r --arg key "$key" '.contracts[$key].contract_id // empty' "$MANIFEST_FILE")"
  [[ -z "$existing_id" ]] || continue
  recover_tx="$(jq -r --arg key "$key" '[.transactions[] | select(.contract == $key and .type == "deploy" and (.status == "pending" or .status == "success"))][-1].transaction_hash // empty' "$MANIFEST_FILE")"
  [[ -n "$recover_tx" ]] || continue
  constructor_sha="$(jq -r --arg tx "$recover_tx" '.transactions[] | select(.transaction_hash == $tx) | .constructor_args_sha256 // empty' "$MANIFEST_FILE")"
  SEND_RECEIPT="$(fetch_success_receipt "$recover_tx")" || die "deploy transaction needs operator review before resume: $recover_tx"
  SEND_TX_HASH="$recover_tx"
  SEND_LEDGER="$(jq -r '.ledger // .ledgerSequence // .latestLedger // empty' <<<"$SEND_RECEIPT")"
  [[ "$SEND_LEDGER" =~ ^[0-9]+$ ]] || SEND_LEDGER=null
  jq --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" \
    '(.transactions[] | select(.transaction_hash == $tx)) |= (.status="success" | .ledger=$ledger)' \
    "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
  record_deployed_contract "$key" "$constructor_sha"
  log "recovered successful deploy before simulation: $key; tx=$SEND_TX_HASH"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true and .value.deploy_instance == true) | .key' "$LOCK_FILE")

# Phase 2 fee gate: now that every code ledger entry exists, simulate every global
# instance with a stable salt. Discard these XDRs so each sent tx gets a fresh sequence.
deploy_fee_stroops=0
while IFS= read -r key; do
  existing_id="$(jq -r --arg key "$key" '.contracts[$key].contract_id // empty' "$MANIFEST_FILE")"
  if [[ -n "$existing_id" ]]; then
    actual="$($STELLAR26 contract info hash --contract-id "$existing_id" --network "$MAINNET_NETWORK_NAME" --config-dir "$CLI_CONFIG_DIR")"
    expected="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
    [[ "$actual" == "$expected" ]] || die "manifest contract points to another WASM: $key"
    continue
  fi
  salt_file="$CACHE_DIR/salts/$key.hex"
  [[ -f "$salt_file" ]] || { od -An -N32 -tx1 /dev/urandom | tr -d ' \n' >"$salt_file"; printf '\n' >>"$salt_file"; }
  salt="$(tr -d '\n' <"$salt_file")"
  wasm_hash="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  wasm="$(artifact_path "$key")"
  if [[ "$key" == origin_verifier ]]; then
    raw_simulated="$("$STELLAR26" --config-dir "$CLI_CONFIG_DIR" contract deploy --network "$MAINNET_NETWORK_NAME" --source-account "$deployer_public" --wasm "$wasm" \
      --optimize=false --salt "$salt" --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only -- \
      --rp_id_hash "$ORIGIN_RP_HASH" --allowed_origins "$ORIGIN_BYTES_JSON")"
  else
    raw_simulated="$(stellar_mainnet contract deploy --source-account "$deployer_public" --wasm "$wasm" \
      --optimize=false --salt "$salt" --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
  fi
  assert_create_xdr_wasm_hash "$raw_simulated" "$wasm_hash"
  simulated="$(simulate_mainnet_xdr "$deployer_public" "$raw_simulated")"
  assert_create_xdr_wasm_hash "$simulated" "$wasm_hash"
  fee="$(xdr_fee_stroops "$simulated")"
  deploy_fee_stroops=$((deploy_fee_stroops + fee))
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true and .value.deploy_instance == true) | .key' "$LOCK_FILE")

successful_fee_stroops="$(jq '[.transactions[] | select(.status == "success") | .fee_stroops] | add // 0' "$MANIFEST_FILE")"
total_estimated_stroops=$((successful_fee_stroops + deploy_fee_stroops))
max_stroops="$(awk -v value="$MAINNET_MAX_TOTAL_FEE_XLM" 'BEGIN { printf "%.0f", value * 10000000 }')"
((total_estimated_stroops <= max_stroops)) || die 'upload plus deploy simulations exceed MAINNET_MAX_TOTAL_FEE_XLM'
total_estimated_xlm="$(stroops_to_xlm "$total_estimated_stroops")"
jq --arg estimate "$total_estimated_xlm" '.fee_budget.estimated_xlm=$estimate' "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
log "all-transaction fee gate: $total_estimated_xlm / $MAINNET_MAX_TOTAL_FEE_XLM XLM"

# Phase 3: create only the four source-defined global instances.
while IFS= read -r key; do
  expected="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  existing_id="$(jq -r --arg key "$key" '.contracts[$key].contract_id // empty' "$MANIFEST_FILE")"
  if [[ -n "$existing_id" ]]; then
    actual="$(stellar_mainnet contract info hash --contract-id "$existing_id")"
    [[ "$actual" == "$expected" ]] || die "resume verification failed: $key"
    log "instance already deployed and matched; skipping: $key"
    continue
  fi
  pending_tx="$(jq -r --arg key "$key" '[.transactions[] | select(.contract == $key and .type == "deploy" and .status == "pending")][-1].transaction_hash // empty' "$MANIFEST_FILE")"
  constructor_sha="$(jq -r --arg key "$key" '[.transactions[] | select(.contract == $key and .type == "deploy" and .status == "pending")][-1].constructor_args_sha256 // empty' "$MANIFEST_FILE")"
  if [[ -n "$pending_tx" ]]; then
    SEND_RECEIPT="$(fetch_success_receipt "$pending_tx")" || die "pending deploy transaction needs operator review before resume: $pending_tx"
    SEND_TX_HASH="$pending_tx"
    SEND_LEDGER="$(jq -r '.ledger // .ledgerSequence // .latestLedger // empty' <<<"$SEND_RECEIPT")"
    [[ "$SEND_LEDGER" =~ ^[0-9]+$ ]] || SEND_LEDGER=null
    jq --arg tx "$SEND_TX_HASH" --argjson ledger "$SEND_LEDGER" \
      '(.transactions[] | select(.transaction_hash == $tx)) |= (.status="success" | .ledger=$ledger)' \
      "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
  else
  salt="$(tr -d '\n' <"$CACHE_DIR/salts/$key.hex")"
  constructor_sha=''
  wasm="$(artifact_path "$key")"
  if [[ "$key" == origin_verifier ]]; then
    constructor_sha="$ORIGIN_ARGS_SHA"
    raw_unsigned="$("$STELLAR26" --config-dir "$CLI_CONFIG_DIR" contract deploy --network "$MAINNET_NETWORK_NAME" --source-account "$deployer_public" --wasm "$wasm" \
      --optimize=false --salt "$salt" --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only -- \
      --rp_id_hash "$ORIGIN_RP_HASH" --allowed_origins "$ORIGIN_BYTES_JSON")"
  else
    raw_unsigned="$(stellar_mainnet contract deploy --source-account "$deployer_public" --wasm "$wasm" \
      --optimize=false --salt "$salt" --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
  fi
  assert_create_xdr_wasm_hash "$raw_unsigned" "$expected"
  unsigned="$(simulate_mainnet_xdr "$deployer_public" "$raw_unsigned")"
  assert_create_xdr_wasm_hash "$unsigned" "$expected"
  artifact_sha="$(jq -r --arg key "$key" '.contracts[$key].artifact_sha256' "$LOCK_FILE")"
  send_unsigned_xdr deploy "$key" "$unsigned" "$artifact_sha" "$expected" "$constructor_sha"
  fi
  record_deployed_contract "$key" "$constructor_sha"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true and .value.deploy_instance == true) | .key' "$LOCK_FILE")

actual_fee_stroops="$(jq '[.transactions[] | select(.status == "success") | .fee_stroops] | add // 0' "$MANIFEST_FILE")"
actual_fee_xlm="$(stroops_to_xlm "$actual_fee_stroops")"
jq --arg actual "$actual_fee_xlm" '.contracts.smart_account.global_instance=false | .status="deployed-awaiting-verification" | .fee_budget.actual_xlm=$actual' "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"
log 'Mainnet core transaction phase complete; no smart-account user instance was created'
log "native SAC derived only: $sac_native"
log 'run contracts/scripts/mainnet-verify.sh before recording evidence'
