# SPIKE-PASSKEY — kết quả 3 gate (PHA 2.1, 2026-07-23)

> Input bắt buộc của mọi việc sau (skill passkey §6). Câu hỏi quyết định: **MỘT credential
> passkey (một key secp256r1) ký từ BA origin — verifier on-chain có nhận cả ba khi kiểm
> `rpIdHash` + allow-list `origin` không?**

## KẾT LUẬN: CÓ — verifier chấp nhận allow-list 3 origin. Mô hình "một rpId — ba origin" ĐI TIẾP. Không cần fallback signer-riêng-từng-vỏ.

## Ba chuỗi origin nguyên văn (đã ném vào verifier)

| Vỏ | origin trong clientDataJSON (nguyên văn) | Verifier phản ứng |
|---|---|---|
| Web | `https://vigiadinh.com` | ✅ CHẤP NHẬN — tx testnet [`3f31867048e8…`](https://stellar.expert/explorer/testnet/tx/3f31867048e871483552042ba6cea2db312057b216a2b7f2203bd50781dd31b2) |
| APK | `android:apk-key-hash:TEST` | ✅ CHẤP NHẬN — tx testnet [`7f71decc1a1f…`](https://stellar.expert/explorer/testnet/tx/7f71decc1a1f71fdc85e8b8c1b3abf6ae4f49d4260cf2ec4f37edc1e31872244) |
| Extension | `chrome-extension://abcdefghijklmnopabcdefghijklmnop` | ✅ CHẤP NHẬN — tx testnet [`33f5263770e5…`](https://stellar.expert/explorer/testnet/tx/33f5263770e5a3a5952d5f32c97e33305bffd039bd81d79330f29d1ee372d014) |
| (đối chứng) | `https://evil.example` | ❌ CHỐI — `Error(Contract, #5)` = `OriginNotAllowed` (simulation fail, không lên chain) |

## Verifier trên testnet

- Contract: `CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP`
  ([deploy tx `ead78f8a…`](https://stellar.expert/explorer/testnet/tx/ead78f8a1fabdde58d65e82a03949eab0af47c52a05332d70f1ab3ba9cd2f57b))
- Nguồn: `contracts/verifier-webauthn/` — soroban-sdk 27.0.2, build `stellar contract build`
  (wasm32v1-none, 4.5KB). Kiểm: rpIdHash pin MỘT giá trị (K1) + allow-list origin BA giá trị (K1)
  + challenge so PREFIX theo thuật toán limited-verification của spec WebAuthn (K2) + cờ UP+UV
  + `env.crypto().secp256r1_verify`.
- `rp_id_hash` = sha256(`vigiadinh.com`) = `72590c6b…ba0b7a4c`. ⚠️ Spike dùng domain dự kiến;
  bảng lỗi skill: **chốt domain production TRƯỚC passkey đầu tiên** — rpId không đổi được.
- Unit test 8/8 pass (`cargo test -p verifier-webauthn`): 3 origin qua · origin lạ #5 ·
  rpIdHash sai #2 · challenge lệch #4 (chống ký mù + replay tx mới) · thiếu UV #3 · chữ ký sửa 1 byte chối.

## Trạng thái từng gate — trung thực về cái gì thật, cái gì mô phỏng

- **Gate 3 (QUYẾT ĐỊNH) — CHẠY THẬT trên testnet**: 3 chữ ký (cùng MỘT key) từ 3 origin đều
  được contract nhận trong 3 transaction thật; origin thứ 4 bị chối bằng đúng mã lỗi.
- **Gate 1 (web → extension) — MÔ PHỎNG + TODO máy thật**: máy build không chạy được browser
  (thiếu libnspr4/libnss3/libasound2, không sudo — BUILD-LOG PHA 1.5). Assertion được sinh
  bằng p256 đúng byte-layout WebAuthn (authenticatorData || sha256(clientDataJSON), origin
  nằm trong clientDataJSON được ký). Điều Gate 1 muốn chứng minh THÊM (Chrome 122+ cho
  extension gọi `credentials.get({rpId})` của domain qua host_permissions) chưa kiểm được
  ở đây → **TODO PHA 9.1 trên máy có browser**; rủi ro đặt ở tầng UX, không phải verifier.
- **Gate 2 (web → APK) — origin mẫu theo đúng checklist**: chưa có máy Android → dùng
  `android:apk-key-hash:TEST` như checklist 2.1 cho phép. Format thật khi có cert:
  `android:apk-key-hash:<base64url-sha256-cert>` → thay giá trị trong allow-list lúc PHA 8,
  verifier KHÔNG cần đổi code (chỉ đổi constructor args).

## Hệ quả cho các pha sau

1. Smart account (2.2) gắn signer External (passkey) trỏ verifier này; extension = context rule
   quyền hẹp + `expiration`.
2. Allow-list là constructor args → mỗi lần chốt cert APK/extension ID thật chỉ cần deploy
   instance mới (WASM hash giữ nguyên), không sửa code.
3. Challenge PHẢI dẫn xuất từ tx đã simulate (K2) — verifier đã enforce khớp challenge,
   tầng FE (2.3) chịu trách nhiệm derive.
