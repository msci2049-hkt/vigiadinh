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

# Artifact-only mode also exercises the CLI 26.1.0 create-contract XDR path.
# The locked Testnet account is only a public sequence source for simulation;
# no alias, secret, signature, or transaction submission is involved.
origin_constructor_values \
  "$(jq -r '.origin_config.rp_id' "$LOCK_FILE")" \
  "$(jq -c '.origin_config.allowed_origins' "$LOCK_FILE")"
estimate_testnet_deploy_fees

if [[ "$MODE" == --artifact-only ]]; then
  log 'PASS: all six release artifacts match the lock and Testnet on-chain hashes'
  log 'PASS: CLI 26.1.0 deploy XDR pipeline simulated all four global instances read-only'
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

# Simulate every required upload against Mainnet. Deploy-instance simulations were
# already performed read-only on live Testnet against the byte-identical artifacts
# (whose minimum interface protocol is locked separately in artifacts.lock.json).
# A fixed 2x safety factor gates their estimated resource fees before the first
# Mainnet transaction. Deploy repeats exact Mainnet simulation after uploads.
estimated_stroops=0
mkdir -p "$PREFLIGHT_DIR"
costs='[]'
while IFS= read -r key; do
  wasm="$(artifact_path "$key")"
  raw_xdr="$(stellar_mainnet contract upload --source-account "$deployer_public" --wasm "$wasm" \
    --optimize=false --inclusion-fee "${MAINNET_INCLUSION_FEE_STROOPS:-100}" --build-only)"
  xdr="$(simulate_mainnet_xdr "$deployer_public" "$raw_xdr")"
  fee="$(xdr_fee_stroops "$xdr")"
  [[ "$fee" =~ ^[0-9]+$ && "$fee" -gt 100 ]] || die "invalid Mainnet upload simulation fee: $key"
  estimated_stroops=$((estimated_stroops + fee))
  costs="$(jq -cn --argjson old "$costs" --arg name "$key" --argjson fee "$fee" \
    '$old + [{type:"upload",contract:$name,fee_stroops:$fee,estimate_network:"mainnet",transaction_sent:false}]')"
done < <(jq -r '.contracts | to_entries[] | select(.value.required == true) | .key' "$LOCK_FILE")

estimated_stroops=$((estimated_stroops + TESTNET_DEPLOY_ESTIMATED_STROOPS))
costs="$(jq -cn --argjson uploads "$costs" --argjson deploys "$TESTNET_DEPLOY_COSTS_JSON" '$uploads + $deploys')"
fee_safety_multiplier=2
guarded_stroops=$((estimated_stroops * fee_safety_multiplier))
estimated_xlm="$(stroops_to_xlm "$estimated_stroops")"
guarded_xlm="$(stroops_to_xlm "$guarded_stroops")"
max_stroops="$(awk -v value="$MAINNET_MAX_TOTAL_FEE_XLM" 'BEGIN { printf "%.0f", value * 10000000 }')"
((guarded_stroops <= max_stroops)) || die '2x guarded all-transaction estimate exceeds MAINNET_MAX_TOTAL_FEE_XLM'

report="$PREFLIGHT_DIR/latest.json"
jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg git_sha "$(git -C "$REPO_ROOT" rev-parse HEAD)" \
  --arg rpc "$RPC_REDACTED" --arg public_key "$deployer_public" \
  --arg network_id "$(network_id)" --argjson protocol "$protocol" \
  --arg artifact_lock_sha256 "$(sha256sum "$LOCK_FILE" | awk '{print $1}')" \
  --arg origin_constructor_args_sha256 "$ORIGIN_ARGS_SHA" \
  --arg all_transaction_estimate_xlm "$estimated_xlm" --arg guarded_estimate_xlm "$guarded_xlm" \
  --argjson safety_multiplier "$fee_safety_multiplier" --arg max_total_fee_xlm "$MAINNET_MAX_TOTAL_FEE_XLM" \
  --argjson testnet_simulation_protocol "$TESTNET_SIMULATION_PROTOCOL" \
  --argjson costs "$costs" \
  '{schema_version:1,status:"all-transaction-preflight-pass",generated_at:$generated_at,
    git_sha:$git_sha,rpc_host_redacted:$rpc,deployer_public_key:$public_key,
    network:{id:$network_id,protocol:$protocol},artifact_lock_sha256:$artifact_lock_sha256,
    origin_constructor_args_sha256:$origin_constructor_args_sha256,
    fees:{all_transaction_estimate_xlm:$all_transaction_estimate_xlm,
      guarded_estimate_xlm:$guarded_estimate_xlm,safety_multiplier:$safety_multiplier,
      testnet_simulation_protocol:$testnet_simulation_protocol,
      max_total_fee_xlm:$max_total_fee_xlm,transactions:$costs},
    note:"Uploads were simulated on Mainnet. Deploys were simulated read-only with identical locked bytes and constructor config on live Testnet, then guarded at 2x; exact Mainnet deploy simulation repeats after uploads and before the first instance transaction."}' >"$report"

log "simulated all-transaction estimate: $estimated_xlm XLM"
log "2x guarded estimate: $guarded_xlm XLM"
log "total fee budget: $MAINNET_MAX_TOTAL_FEE_XLM XLM"
log "preflight report: ${report#"$REPO_ROOT"/}"
if [[ "${EXECUTE_MAINNET_DEPLOY:-NO}" == YES ]]; then
  log 'PASS: execution opt-in is YES; deploy script may continue to its second fee gate'
else
  log 'PASS: preflight only; EXECUTE_MAINNET_DEPLOY is not YES'
fi
