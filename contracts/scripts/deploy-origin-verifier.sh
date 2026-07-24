#!/usr/bin/env bash
# Deploy origin-verifier PRODUCTION — pin rpIdHash domain thật + allow-list 3 origin
# (web / APK / extension). Bản testnet hiện tại là DEV localhost; production PHẢI
# instance mới pin domain thật (luật K1 — skill stellar-security).
#
# Tham số hoá hoàn toàn — chạy được khi CÓ domain + cert + key. Không hardcode gì.
#
# Dùng:
#   RP_ID=vigiadinh.com \
#   ORIGIN_WEB=https://vigiadinh.com \
#   ORIGIN_APK="android:apk-key-hash:<base64url-sha256-cert-phát-hành>" \
#   ORIGIN_EXT="chrome-extension://aakakeieeijeflbnblolnlhmooibddmc" \
#   SOURCE=deployer-mainnet NETWORK=mainnet \
#   ./contracts/scripts/deploy-origin-verifier.sh
#
# rpIdHash = sha256(RP_ID) (32 byte). Constructor: (rp_id_hash: BytesN<32>,
# allowed_origins: Vec<Bytes>) — xem contracts/origin-verifier/src/lib.rs.
set -euo pipefail

: "${RP_ID:?cần RP_ID (vd vigiadinh.com)}"
: "${ORIGIN_WEB:?cần ORIGIN_WEB (https://domain)}"
: "${ORIGIN_APK:?cần ORIGIN_APK (android:apk-key-hash:...)}"
: "${ORIGIN_EXT:?cần ORIGIN_EXT (chrome-extension://<id>)}"
: "${SOURCE:?cần SOURCE (alias khoá stellar-cli)}"
: "${NETWORK:?cần NETWORK (testnet|mainnet)}"

WASM="target/wasm32v1-none/release/origin_verifier.wasm"
[ -f "$WASM" ] || { echo "Build trước: stellar contract build"; exit 1; }

# rpIdHash = sha256(RP_ID) → hex 64 ký tự.
RP_ID_HASH=$(printf '%s' "$RP_ID" | openssl dgst -sha256 -binary | xxd -p -c 64)
echo "rpIdHash($RP_ID) = $RP_ID_HASH"
echo "origins: $ORIGIN_WEB | $ORIGIN_APK | $ORIGIN_EXT"

# allowed_origins: Vec<Bytes> — mỗi origin là chuỗi UTF-8 dạng Bytes.
# stellar-cli nhận Bytes qua hex; Vec qua JSON array các hex.
to_hex() { printf '%s' "$1" | xxd -p -c 10000; }
ORIGINS_JSON=$(printf '["%s","%s","%s"]' \
  "$(to_hex "$ORIGIN_WEB")" "$(to_hex "$ORIGIN_APK")" "$(to_hex "$ORIGIN_EXT")")

stellar contract deploy \
  --wasm "$WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --rp_id_hash "$RP_ID_HASH" \
  --allowed_origins "$ORIGINS_JSON"

echo "✅ Deployed origin-verifier prod. Cập nhật:"
echo "   - FE VITE_WEBAUTHN_VERIFIER_ADDRESS = <địa chỉ vừa in>"
echo "   - docs/DEPLOY.md bảng contract"
