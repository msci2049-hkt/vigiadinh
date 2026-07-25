---
name: stellar-security
description: >
  Bảo mật toàn tầng cho ví/dApp trên Stellar-Soroban: contract (auth, storage, Val round-trip, DoS,
  phiếu ma, TTL/archival), tầng ký WebAuthn/passkey (origin allow-list 3 vỏ, challenge bind transaction,
  AddressV2 chống replay), backend không-custody (approval binding, chống chiếm server), và vận hành
  mainnet (indexer checkpoint, extend TTL, Audit Bank). Dùng khi: viết/review contract Soroban, thiết kế
  luồng ký, audit trước deploy, viết threat model, sửa lỗ hổng recovery/guardian, hoặc bất kỳ việc gì
  đụng tới tiền thật trên Stellar. Trigger: bảo mật, security, audit, require_auth, lỗ hổng, threat model,
  replay, DoS, phiếu ma, timelock, veto, custody, Soroban, khôi phục ví, thừa kế on-chain.
---

# Stellar Security — bảo mật toàn tầng cho ví gia đình

Chưng cất từ: checklist Veridise (audit Soroban Core cho SDF), audit OZ stellar-contracts RC v0.7.0,
CertiK state-management, CAP-0071, và hai lỗ hổng đã tự tìm ra trong Recovery Registry của dự án.

## 4 bất biến sản phẩm — mọi quyết định suy ra từ đây

1. **Custody nằm trên chuỗi.** Backend sập → không ai mất tiền, không ai mất quyền khôi phục.
2. **Backend/AI không bao giờ tạo được chữ ký hợp lệ thay chủ ví.** Không key, không ký, không hàm ghi.
3. **Server không đọc được di chúc.** Mã hoá tại máy trước khi rời thiết bị.
4. **Mọi thay đổi quyền có thời gian chờ + cửa phủ quyết + audit.**

Câu hỏi thử vàng cho mọi thiết kế: *"Chiếm được backend thì làm được gì?"*
Đáp án bắt buộc: **KHÔNG mất tiền, KHÔNG đọc được di chúc.** Đáp án khác = thiết kế sai, sửa thiết kế chứ đừng vá.

## Tầng 1 — Contract Soroban

| # | Luật | Vì sao / cách kiểm |
|---|---|---|
| C1 | `require_auth()` trên **mọi** hàm đổi state, và auth **đúng địa chỉ chịu trách nhiệm** — không tin `Address` truyền vào tham số | Lỗi số 1 mọi audit. Test: gọi hàm với address A nhưng auth bằng B → phải panic |
| C2 | `panic_with_error!` + enum error có mã số — **cấm** `panic!`, `unwrap`, `expect` trong đường chạy | Fuzzer Soroban coi `panic!` trần là bug; error có mã thì FE giải thích được |
| C3 | **Val round-trip validation**: mọi kiểu lấy từ storage/tham số container phải validate tường minh | Soroban convert container → raw host value KHÔNG đảm bảo round-trip an toàn kiểu; thiếu validate → halt hoặc logic sai (phát hiện của Veridise khi audit Soroban Core) |
| C4 | **Instance storage: cấm dữ liệu unbounded** (Vec/Map lớn dần) | Instance load TOÀN BỘ mỗi lần gọi contract → phí tăng dần → DoS. Danh sách lớn dần → persistent, **phân mảnh theo key** (`(WALLET, seq)`), không nhồi một entry |
| C5 | Persistent entry có thể bị **archive khi hết TTL** — code phải sống sót khi entry cần restore | Đường "happy 6 tháng sau" là đường chết kinh điển của ví thừa kế: heartbeat 6 tháng không ai gọi → entry archive → claim fail. Cron `extendTtl` cho mọi entry sống còn |
| C6 | Số tiền: `i128`, **checked arithmetic**, basis-points cho %; cấm float | Overflow im lặng = mất tiền |
| C7 | **Re-validate từng phiếu với danh sách guardian HIỆN TẠI lúc finalize** | Lỗ hổng "phiếu ma" đã tìm ra: guardian bị gỡ giữa chừng nhưng phiếu cũ vẫn đếm. `finalize_recovery` phải lọc lại |
| C8 | **Mọi request Pending phải có expiry** hoặc ≥threshold guardian cùng cancel được | Lỗ hổng DoS đã tìm ra: một request treo vĩnh viễn chặn mọi request sau |
| C9 | Veto thắng threshold, **kể cả sau khi đủ phiếu, miễn còn trong timelock** | Test bắt buộc: veto-sau-finalize, removed-guardian-vote |
| C10 | Mỗi thay đổi trạng thái phát **event** đủ dữ liệu cho indexer tự dựng lại mirror | Không event = không audit trail = không cảnh báo |
| C11 | Policy đổi phải **version hoá**, chỉ áp cho intent mới; version cũ superseded, không sửa đè | Approval bind vào policy version — sửa đè là phá binding |
| C12 | Upgrade: nếu contract upgradeable thì hàm upgrade đi qua đúng cửa guardian+timelock như đổi quyền | Admin key upgrade một mình = cửa hậu phá cả 4 bất biến |

**Chống-lockout:** mọi thao tác gỡ/thay guardian phải VALIDATE `available_count ≥ threshold` **sau** khi áp. Cho phép tự khoá mình ra ngoài là bug nghiêm trọng ngang mất tiền.

**Test tối thiểu trước audit** (Audit Bank yêu cầu: test suite đáng kể + threat analysis + spec invariant):
happy path + cancel + expiry cho từng flow · veto-sau-đủ-phiếu · guardian-đã-gỡ-vote · double-finalize ·
claim-trước-hạn-im-lặng · owner-heartbeat-reset-giữa-claim · fuzz bằng cargo-fuzz · snapshot test.

## Tầng 2 — Ký & WebAuthn (chỗ ví passkey chết nhiều nhất)

| # | Luật | Vì sao |
|---|---|---|
| K1 | Verifier kiểm `rpIdHash` (MỘT giá trị) + **allow-list `origin`** (BA giá trị: `https://…`, `android:apk-key-hash:…`, `chrome-extension://…`) | Cả `rpIdHash` lẫn `origin` đều nằm trong dữ liệu **được ký**. Pin cứng một origin → vỏ APK/extension ký hỏng 100% |
| K2 | **Challenge = dẫn xuất từ transaction đã simulate**, KHÔNG phải random | Challenge random = chữ ký không bind vào nội dung tx = người dùng "ký mù". Meridian Pay (production) làm đúng mẫu này |
| K3 | Chữ ký chủ ví bind vào **canonical transaction bytes** — cấm ký JSON tuỳ ý | Sequence conflict / rebuild tx → chữ ký cũ phải invalid tự nhiên |
| K4 | Dùng credential **AddressV2** (CAP-0071-02, Protocol 27): payload gắn địa chỉ người ký, chặn replay chéo tài khoản | V1 chưa bị bỏ nhưng sẽ thay ở Protocol 28 — migrate sớm, đừng đợi deadline |
| K5 | Approval của guardian bind: `intent_hash + amount + recipient + policy_version + expiry + guardian_device` | **Cấm tuyệt đối boolean `approved=true` tái dùng được.** Sửa amount sau approval → approval cũ tự chết, tạo intent version mới |
| K6 | Biometric challenge có TTL riêng; hết hạn → quay lại review, re-run policy | Approval sống lâu hơn điều kiện nó duyệt = lỗ hổng |

## Tầng 3 — Backend không-custody

- **Grep pre-commit bắt secret:** `S[A-Z0-9]{55}` (seed Stellar), `Keypair.fromSecret`, `signTransaction` phía server. Có match trong đường ký thay user = cờ đỏ dừng ngay. (Server ĐƯỢC ký thứ của chính nó: fee-bump từ ví phí riêng, service identity — tách ví, tách quyền.)
- **XDR từ ngoài là input thù địch.** Parse bằng SDK, validate schema, cấm eval chuỗi tự do.
- **LLM là hostile user (OWASP):** input cho AI = JSON cấu trúc, chuỗi tự do on-chain bị placeholder hoá; AI không secret, không route ghi; output validate không chứa URL/lời xúi "cứ duyệt đi"; kill-switch: tắt AI → template tĩnh, mọi luồng vẫn chạy.
- **Risk score KHÔNG bao giờ tự cancel giao dịch** — chỉ trì hoãn + báo động. Cho score tự cancel = tự chế DoS mới.
- Fingerprint/hành vi tính client-side, chỉ gửi kết quả — không gửi raw behavior.
- Recovery alert phải đi **kênh ngoài app** (SMS/email) và veto hoạt động từ kênh dự phòng — chiếm được app không được chiếm luôn kênh báo động.

## Tầng 4 — Vận hành

- RPC chính + fallback; **`getEvents` chỉ giữ ≤7 ngày** (mặc định node ~24h) → indexer phải checkpoint ledger vào DB; sập quá cửa sổ = mất event vĩnh viễn → dựng lại mirror từ state contract + ghi lỗ hổng audit, không đoán.
- Cron extend TTL mọi entry sống còn (C5). Kiểm bằng job báo động entry sắp hết TTL.
- Trước mainnet: chạy trọn checklist go-live; đăng ký **Soroban Security Audit Bank** ngay khi đủ điều kiện (report bắt buộc open-source — đọc 40-50 report cũ trước, lỗi state management lặp lại nhiều nhất); pin version mọi crate OZ, coi khung policy là chưa-audit cho tới khi có report đúng version đang dùng.

## Threat model 1 trang — 5 kẻ địch, mỗi dòng một đòn đỡ

| Kẻ địch | Đòn đỡ chính |
|---|---|
| Kẻ lừa guardian (giả chủ ví) | Checkbox "đã gọi xác minh" bắt buộc + risk banner + timelock + owner veto mọi kênh |
| Guardian thông đồng ≥threshold | Timelock dài + notify đa kênh + owner veto thắng threshold; diệt hẳn bằng policy on-chain (Smart Account) |
| Chiếm backend | Bất biến 1+2+3: không key, blob mã hoá, custody on-chain — mất availability, không mất tiền |
| Chiếm AI | AI không secret, không quyền ghi, output validate, kill-switch |
| Mất máy hàng loạt (nhà cháy) | Passkey sync qua platform + guardian ngoài hộ gia đình + heartbeat ladder |

## Cổng nghiệm thu cứng (thiếu 1 = CHƯA XONG)
1. Test C7+C8+C9 xanh. 2. Verifier nhận đủ 3 origin trên testnet. 3. Grep secret sạch + câu "chiếm backend" trả lời đúng bằng thiết kế thật. 4. Indexer sống sót restart giữa chừng không mất event. 5. Threat model 1 trang tồn tại và khớp code.
