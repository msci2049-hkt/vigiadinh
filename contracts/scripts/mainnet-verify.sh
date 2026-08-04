#!/usr/bin/env bash
# Read-only verification of a completed dormant Mainnet core deployment.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/mainnet-common.sh"

require_base_tools
load_mainnet_env || die "missing operator config: $ENV_FILE"
mapfile -t missing < <(missing_gate_names)
((${#missing[@]} == 0)) || { printf '%s\n' "${missing[@]}"; exit 2; }
validate_mainnet_config
validate_git_state
configure_isolated_network
origin_constructor_values
prepare_and_verify_artifacts

[[ -f "$MANIFEST_FILE" ]] || die 'manifest.json does not exist; no deployment to verify'
[[ "$(jq -r '.deployment_type' "$MANIFEST_FILE")" == mainnet-core-dormant ]] || die 'unexpected manifest deployment type'
[[ "$(jq -r '.application_runtime' "$MANIFEST_FILE")" == testnet ]] || die 'manifest must keep the application runtime on Testnet'
[[ "$(jq -r '.network.network_id' "$MANIFEST_FILE")" == "$(network_id)" ]] || die 'manifest network mismatch'

mkdir -p "$VERIFY_DIR"
verified_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
summary='[]'

while IFS= read -r key; do
  contract_id="$(jq -r --arg key "$key" '.contracts[$key].contract_id // empty' "$MANIFEST_FILE")"
  [[ "$contract_id" =~ ^C[A-Z2-7]{55}$ ]] || die "missing Mainnet contract ID: $key"
  expected="$(jq -r --arg key "$key" '.contracts[$key].wasm_hash' "$LOCK_FILE")"
  actual="$(stellar_mainnet contract info hash --contract-id "$contract_id")"
  [[ "$actual" == "$expected" ]] || die "Mainnet on-chain WASM hash mismatch: $key"

  stellar_mainnet contract info env-meta --contract-id "$contract_id" --output json-formatted >"$VERIFY_DIR/$key.env-meta.json"
  stellar_mainnet contract info meta --contract-id "$contract_id" --output json-formatted >"$VERIFY_DIR/$key.meta.json"
  stellar_mainnet contract info interface --contract-id "$contract_id" --output json-formatted >"$VERIFY_DIR/$key.interface.json"
  if stellar_mainnet contract info build --contract-id "$contract_id" >"$VERIFY_DIR/$key.build.txt" 2>&1; then
    build_status='available'
  else
    build_status='unavailable'
  fi

  explorer_status='unavailable'
  explorer_url="https://stellar.expert/explorer/public/contract/$contract_id"
  explorer_json="$(curl -fsS --max-time 15 "https://api.stellar.expert/explorer/public/contract/$contract_id" 2>/dev/null || true)"
  if jq -e . >/dev/null 2>&1 <<<"$explorer_json"; then
    explorer_status="$(jq -r '.contract.validation.status // .validation.status // "unavailable"' <<<"$explorer_json")"
  fi
  case "$explorer_status" in
    verified) status='verified' ;;
    failed|invalid) status='verification-failed' ;;
    *) status='verification-pending' ;;
  esac
  summary="$(jq -cn --argjson old "$summary" --arg key "$key" --arg id "$contract_id" \
    --arg hash "$actual" --arg build "$build_status" --arg explorer "$explorer_status" --arg explorer_url "$explorer_url" --arg status "$status" \
    '$old + [{contract:$key,contract_id:$id,wasm_hash:$hash,hash_match:true,build_metadata:$build,
      explorer_status:$explorer,explorer_url:$explorer_url,status:$status}]')"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true and .value.deploy_instance == true) | .key' "$LOCK_FILE")

# Smart-account is code-only: fetch by WASM hash and compare bytes. No user instance is expected.
smart_hash="$(jq -r '.contracts.smart_account.wasm_hash' "$LOCK_FILE")"
smart_file="$VERIFY_DIR/smart-account.mainnet.wasm"
smart_fresh="$VERIFY_DIR/.smart-account.mainnet.$$.$RANDOM.wasm"
if stellar_mainnet contract fetch --wasm-hash "$smart_hash" --out-file "$smart_fresh"; then
  mv -- "$smart_fresh" "$smart_file"
else
  rm -f -- "$smart_fresh"
  die 'smart-account WASM is not retrievable from live Mainnet'
fi
[[ "$(sha256sum "$smart_file" | awk '{print $1}')" == "$smart_hash" ]] || die 'smart-account Mainnet WASM mismatch'

# Native SAC is derived, never custom-deployed.
sac_native="$(stellar_mainnet contract id asset --asset native)"
[[ "$sac_native" == "$(jq -r '.contracts.sac_native.contract_id' "$MANIFEST_FILE")" ]] || die 'native SAC derivation mismatch'

# origin-verifier::config is read with --send=no; only a result digest is retained.
origin_id="$(jq -r '.contracts.origin_verifier.contract_id' "$MANIFEST_FILE")"
deployer_public="$(jq -r '.deployer_public_key' "$MANIFEST_FILE")"
origin_view="$("$STELLAR26" --config-dir "$CLI_CONFIG_DIR" contract invoke --network "$MAINNET_NETWORK_NAME" \
  --id "$origin_id" --source-account "$deployer_public" --send=no -- config)"
origin_expected="$(jq -cn --arg rp "$ORIGIN_RP_HASH" --argjson origins "$ORIGIN_BYTES_JSON" '[$rp,$origins]')"
[[ "$(jq -c . <<<"$origin_view")" == "$origin_expected" ]] || die 'origin-verifier config differs from the reviewed constructor lock'
origin_view_sha="$(printf '%s' "$origin_view" | sha256sum | awk '{print $1}')"

jq -n --arg verified_at "$verified_at" --arg network_id "$(network_id)" \
  --arg git_sha "$(jq -r '.source.git_commit' "$MANIFEST_FILE")" --arg smart_hash "$smart_hash" \
  --arg sac "$sac_native" --arg origin_view_sha "$origin_view_sha" --argjson contracts "$summary" \
  '{schema_version:1,verified_at:$verified_at,network_id:$network_id,git_sha:$git_sha,
    contracts:$contracts,smart_account:{wasm_hash:$smart_hash,hash_match:true,global_instance:false},
    sac_native:{contract_id:$sac,source:"derived",custom_deployment:false},
    read_only_smoke:{origin_verifier_config_result_sha256:$origin_view_sha,transaction_sent:false}}' \
  >"$VERIFY_DIR/summary.json"

jq --arg verified_at "$verified_at" --argjson verification "$summary" \
  '.status="deployed" | .verified_at=$verified_at | .verification=$verification |
   .contracts.smart_account.status="wasm_verified" | .contracts.smart_account.global_instance=false |
   .contracts.sac_native.status="derived_verified"' "$MANIFEST_FILE" | json_atomic_write "$MANIFEST_FILE"

log 'PASS: all required Mainnet instances match the locked WASM hashes'
log 'PASS: smart-account WASM matched; no global/user instance was required'
log "PASS: native SAC derived only: $sac_native"
log 'Explorer status was recorded exactly as returned; verification is not an audit'
