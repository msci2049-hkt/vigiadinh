#!/usr/bin/env bash
# Static artifact verification plus fail-closed Mainnet execution gates.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/mainnet-common.sh"

MODE="${1:-full}"
[[ "$MODE" == full || "$MODE" == --artifact-only ]] || die 'usage: mainnet-preflight.sh [--artifact-only]'

require_base_tools
prepare_and_verify_artifacts
verify_testnet_provenance

if [[ "$MODE" == --artifact-only ]]; then
  log 'PASS: all six release artifacts match the lock and Testnet on-chain hashes'
  log 'artifact-only mode sent no transaction'
  exit 0
fi

if ! load_mainnet_env; then
  log "Mainnet operator config: MISSING ($ENV_FILE)"
  printf '%s\n' \
    MAINNET_RPC_URL MAINNET_SOURCE_ACCOUNT MAINNET_RP_ID MAINNET_ALLOWED_ORIGINS_JSON \
    MAINNET_NETWORK_PASSPHRASE EXECUTE_MAINNET_DEPLOY MAINNET_MAX_TOTAL_FEE_XLM MAINNET_EXPECTED_GIT_SHA \
    MAINNET_NETWORK_NAME MAINNET_MIN_SOURCE_BALANCE_XLM
  exit 2
fi

mapfile -t missing < <(missing_gate_names)
if ((${#missing[@]})); then
  log 'missing Mainnet gates:'
  printf '%s\n' "${missing[@]}"
  exit 2
fi

validate_mainnet_config
validate_git_state
configure_isolated_network

RPC_REDACTED="$(redact_rpc_url "$MAINNET_RPC_URL")"
log "RPC: $RPC_REDACTED"
network_json="$(stellar_mainnet network info --output json)"
[[ "$(jq -r '.passphrase' <<<"$network_json")" == "$MAINNET_PASSPHRASE" ]] || die 'RPC reports a non-Mainnet passphrase'
protocol="$(jq -r '.protocol_version' <<<"$network_json")"
[[ "$protocol" =~ ^[0-9]+$ && "$protocol" -ge 26 ]] || die 'RPC protocol is older than 26'
[[ "$(jq -r '.id' <<<"$network_json")" == "$(network_id)" ]] || die 'RPC network ID mismatch'

deployer_public="$($STELLAR26 keys public-key "$MAINNET_SOURCE_ACCOUNT")"
[[ "$deployer_public" =~ ^G[A-Z2-7]{55}$ ]] || die 'identity alias did not resolve to a public key'
log "deployer public key: $deployer_public"
account_json="$(stellar_mainnet ledger entry fetch account --account "$deployer_public" --output json)"
balance_stroops="$(jq -r '.entries[0].val.account.balance // empty' <<<"$account_json")"
[[ "$balance_stroops" =~ ^[0-9]+$ ]] || die 'deployer account does not exist on Mainnet'
minimum_stroops="$(awk -v value="$MAINNET_MIN_SOURCE_BALANCE_XLM" 'BEGIN { printf "%.0f", value * 10000000 }')"
((balance_stroops >= minimum_stroops)) || die 'deployer balance is below MAINNET_MIN_SOURCE_BALANCE_XLM'
log "deployer balance gate: PASS (minimum ${MAINNET_MIN_SOURCE_BALANCE_XLM} XLM)"

origin_constructor_values

# Simulate every required upload. Deploy-instance simulations are possible only after
# their WASM exists on Mainnet, so the deploy script simulates each deployment again
# after all uploads and before the first instance transaction.
estimated_stroops=0
mkdir -p "$PREFLIGHT_DIR"
costs='[]'
while IFS= read -r key; do
  wasm="$(artifact_path "$key")"
  xdr="$(stellar_mainnet contract upload --source-account "$deployer_public" --wasm "$wasm" \
    --optimize=false --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
  fee="$(xdr_fee_stroops "$xdr")"
  estimated_stroops=$((estimated_stroops + fee))
  costs="$(jq -cn --argjson old "$costs" --arg name "$key" --argjson fee "$fee" '$old + [{type:"upload",contract:$name,fee_stroops:$fee}]')"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true) | .key' "$LOCK_FILE")

estimated_xlm="$(stroops_to_xlm "$estimated_stroops")"
max_stroops="$(awk -v value="$MAINNET_MAX_TOTAL_FEE_XLM" 'BEGIN { printf "%.0f", value * 10000000 }')"
((estimated_stroops <= max_stroops)) || die 'simulated upload fees alone exceed MAINNET_MAX_TOTAL_FEE_XLM'

report="$PREFLIGHT_DIR/latest.json"
jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg git_sha "$(git -C "$REPO_ROOT" rev-parse HEAD)" \
  --arg rpc "$RPC_REDACTED" --arg public_key "$deployer_public" \
  --arg network_id "$(network_id)" --argjson protocol "$protocol" \
  --arg artifact_lock_sha256 "$(sha256sum "$LOCK_FILE" | awk '{print $1}')" \
  --arg origin_constructor_args_sha256 "$ORIGIN_ARGS_SHA" \
  --arg upload_estimate_xlm "$estimated_xlm" --arg max_total_fee_xlm "$MAINNET_MAX_TOTAL_FEE_XLM" \
  --argjson costs "$costs" \
  '{schema_version:1,status:"upload-simulation-pass/deploy-simulation-pending",generated_at:$generated_at,
    git_sha:$git_sha,rpc_host_redacted:$rpc,deployer_public_key:$public_key,
    network:{id:$network_id,protocol:$protocol},artifact_lock_sha256:$artifact_lock_sha256,
    origin_constructor_args_sha256:$origin_constructor_args_sha256,
    fees:{upload_estimate_xlm:$upload_estimate_xlm,max_total_fee_xlm:$max_total_fee_xlm,transactions:$costs},
    note:"Every deploy-instance transaction is simulated after all WASMs exist and before the first instance is sent."}' >"$report"

log "simulated required upload fees: $estimated_xlm XLM"
log "total fee budget: $MAINNET_MAX_TOTAL_FEE_XLM XLM"
log "preflight report: ${report#"$REPO_ROOT"/}"
if [[ "${EXECUTE_MAINNET_DEPLOY:-NO}" == YES ]]; then
  log 'PASS: execution opt-in is YES; deploy script may continue to its second fee gate'
else
  log 'PASS: preflight only; EXECUTE_MAINNET_DEPLOY is not YES'
fi
