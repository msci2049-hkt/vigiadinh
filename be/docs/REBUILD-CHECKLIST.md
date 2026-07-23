# REBUILD-CHECKLIST — dựng lại FamilyWallet 100% từ máy trắng


> ⚠️ **CẬP NHẬT 2026-07-20 — tính năng KÉT DI CHÚC (will vault) ĐÃ HỦY.**
> Mọi mục nhắc "két di chúc", "di chúc mã hóa", "Shamir", "lời nhắn cuối", "anchor will hash",
> "server không đọc được di chúc" trong file này là **lịch sử**, KHÔNG dựng theo.
> Skill `fw-will-vault` còn trên đĩa nhưng không áp dụng. Thừa kế GIỮ LẠI (chia % + heartbeat
> + heir claim), chỉ bỏ phần két/di chúc mã hóa. Xem `docs/TEMPLATE-DEVIATIONS.md`.

Giả định: máy mới tinh, chỉ có git + trình duyệt. Làm đúng thứ tự; mỗi giai đoạn có CỔNG — chưa qua cổng chưa được sang giai đoạn sau. Skill khớp việc ghi trong ngoặc.

## G0 · Máy & tài khoản (nửa ngày)
- [ ] Cài: Rust ≥1.91 (`rustup`), target `wasm32v1-none`, `cargo install --locked stellar-cli --features opt`, Bun, Node 20 + pnpm 9, Docker
- [ ] Tài khoản: GitHub org, Cloudflare (Pages), VPS, Sentry, Resend, Firebase (FCM) + Apple Developer (để sẵn cho P2), API key LLM
- [ ] Chọn domain sản phẩm NGAY (rpId passkey gắn chết vào domain — đổi sau là mất passkey toàn bộ user)
- **CỔNG:** `stellar --version`, `bun -v`, `pnpm -v` chạy; domain đã mua.

## G1 · Khung monorepo (nửa ngày)
- [ ] `familywallet/` bun workspaces: `contracts/` `apps/api` `apps/ai` `apps/web` `packages/shared`
- [ ] Chép bộ cấu hình Claude vào root: `CLAUDE.md`, `.claude/rules/{security,stellar,code-style}.md`, `.claude/agents/` (4 agent), `.claude/skills/` (8 skill), `docs/PROJECT-BRIEF.md`
- [ ] degit `mau-demo-be` → `apps/api`; degit `mau-demo-fe-vite` → `apps/web` (xóa `apps/carbon`); `packages/shared` = types + zod
- [ ] Lefthook + Biome + CI khung (typecheck/lint/test/build/secret-scan) chạy xanh trên repo rỗng
- **CỔNG:** `bun test` (api) + `pnpm validate && pnpm build` (web — honest build) xanh; push lên GitHub, CI xanh.

## G2 · Contract recovery (2–3 ngày) — skill fw-soroban-contracts
- [ ] `contracts/recovery-registry`: register_wallet, add/remove_guardian, initiate/approve/cancel/finalize_recovery + **expiry chống DoS** + **guardian_cancel** + **chống phiếu ma** ngay từ đầu (không tái tạo lỗ hổng cũ)
- [ ] Error enum + `panic_with_error!`; storage persistent/instance; event đủ cho indexer
- [ ] Unit test đủ danh sách case trong skill; 1 fuzz target
- [ ] Deploy testnet → CONTRACT_ID vào `.env` các app + docs
- [ ] Scripts: gen-keys / setup-multisig (guardian w1, master=threshold, thresholds=threshold) / submit-recovery / verify-account / demo.sh / demo-veto.sh — **mỗi script tự chạy độc lập, chạy 2 lần không crash**
- **CỔNG:** agent `soroban-auditor` không còn P0; agent `e2e-verifier` xuất E2E-EVIDENCE.md đủ tx hash (recovery trọn luồng + veto chặn + timelock chặn + 1-guardian fail).

## G3 · Backend nền + presence (1 tuần) — skill fw-guardian-presence
- [ ] Schema Drizzle (CHECK, forward-only): users, wallets, guardians, devices, presence_pings, recovery_requests, notifications, audit_log
- [ ] Better Auth phiên app (cookie) — KHÔNG custody; `TRUSTED_ORIGINS` gồm origin FE
- [ ] Module `presence`: repeatable job 12:00 theo múi giờ chủ ví → silent push → `/presence/ack` → thang active/slow(24h)/offline(72h) + xác-nhận-tay 90 ngày → `available_count` + 2 mức cảnh báo (== threshold: hết dự phòng; < threshold: đỏ) → SSE realtime
- [ ] Luồng nối máy mới: token một-lần 72h
- **CỔNG:** kịch bản "tắt mạng máy guardian 72h (mô phỏng đồng hồ)" ra đúng chuỗi: slow → offline → notify chủ ví 1 lần → ack lại → active + notify hồi phục.

## G4 · Indexer + notifications (3–4 ngày) — skill fw-indexer-notify
- [ ] Worker poll getEvents + checkpoint sau mỗi batch; idempotent theo (tx_hash, event_index)
- [ ] Map event → mirror + notify theo bảng trong skill; template ICU vi/en theo locale TỪNG người nhận; digest 5' trừ sự kiện veto-được
- [ ] Audit log → API "nhật ký kiểm tra"
- **CỔNG:** giết worker 2' giữa luồng demo → bật lại: không mất event, không notification đôi.

## G5 · Web 3 luồng (1 tuần) — spec = vigiadinh-mockup.html
- [ ] i18n từ commit đầu (en mặc định); route theo 8 nhóm màn
- [ ] Luồng 1 thiết lập bảo vệ (copilot để G7, form thường trước) · Luồng 2 khôi phục (poll tiến độ, đếm timelock thật, hướng dẫn ký SetOptions) · Luồng 3 veto khẩn (màn đỏ 1 nút)
- [ ] Màn guardian: banner risk + checkbox "đã gọi xác minh" (bắt buộc khi score ≥30 — nối G6, trước đó luôn hiện)
- [ ] Người gác đêm + nhật ký + trạng thái kết nối (chấm xanh/vàng/đỏ, SSE)
- [ ] Chặn ví sai network; mọi config qua VITE_*
- **CỔNG:** 1 người NGOÀI team dùng 2 điện thoại + 2 tab guardian đi trọn recovery trên testnet không cần ai hướng dẫn; `pnpm build` + e2e Playwright xanh.

## G6 · Risk engine + AI explainer (4–5 ngày) — skill fw-ai-night-watch
- [ ] `apps/ai`: risk score (7 tín hiệu, ngưỡng 30/60) — pure function + bảng test biên
- [ ] Explainer: JSON cấu trúc vào, template ra, output-validate, placeholder mọi chuỗi tự do; kill-switch AI_ENABLED
- [ ] Nối UI: banner vàng liệt kê đúng tín hiệu; >60 = push VETO mọi thiết bị + khóa nút 30'
- **CỔNG:** test injection ("ignore previous instructions" trong memo/tên) không đổi hành vi; tắt AI mọi luồng vẫn đủ; agent `security-reviewer` không P0.

## G7 · Inheritance (1,5 tuần) — skill fw-soroban-contracts

> ~~+ két di chúc / fw-will-vault~~ — ĐÃ HỦY (2026-07-20). Bỏ mọi gạch đầu dòng nhắc di chúc/Shamir/lời nhắn cuối dưới đây.
- [ ] `contracts/inheritance`: set_heir/heartbeat/open/approve/cancel/finalize + anchor_will_hash; test + deploy testnet
- [ ] Backend: nhắc heartbeat (mặc định 30 ngày) + thang leo; API share chỉ mở sau event finalize THẬT (đối chiếu indexer)
- [ ] Client: libsodium mã hóa (secretstream cho video), sha256 → anchor; Shamir 2-of-3 (lib Privy) + tự verify mọi cặp; sealed box share theo device-key guardian; sodium_memzero K
- [ ] UI: soạn di chúc + ghi lời nhắn cuối + màn heir claim (giọng trang trọng — agent ux-writer duyệt)
- **CỔNG:** nghiệm thu 6 mục trong skill fw-will-vault pass, đặc biệt: DB dump chỉ ciphertext; API share trả 403 khi chưa finalize.

## G8 · Copilot + đánh bóng AI (3–4 ngày)
- [ ] Copilot thiết lập (phỏng vấn → điền form, người ký) + copilot di chúc (plaintext không rời máy) + dẫn heir; shadow-mode 2 tuần
- **CỔNG:** ux-writer duyệt toàn bộ lời thoại; security-reviewer xác nhận plaintext không chạm apps/ai.

## G9 · Mobile Capacitor (1 tuần) — skill fw-capacitor-mobile
- [ ] **GATE P0-M1 trước tiên** (passkey + silent push + secure storage trên máy thật 2 ngày; fail → đổi React Native, dừng checklist này ở đây và mở nhánh RN)
- [ ] cap add android/ios; assetlinks.json + apple-app-site-association; push category có nút VETO; biometric gate; deep link; safe-area
- [ ] Internal testing (Play) + TestFlight ≥2 tuần, ≥10 gia đình
- **CỔNG:** bản release-sign chạy lại đủ P0-M1; 1 recovery thật hoàn tất giữa 2 điện thoại thật.

## G10 · Người dùng thử + SCF (song song G7–G9)
- [ ] 10–20 gia đình testnet; đo: % đặt đủ guardian, thời gian khôi phục, % veto giả mạo thành công
- [ ] Nộp SCF Kickstart (số liệu thật + E2E-EVIDENCE); có mặt Discord/cộng đồng Stellar
- **CỔNG:** hồ sơ Kickstart gửi đi.

## G11 · Smart Account + Mainnet (2–3 tuần) — skill stellar-mainnet-deploy
- [ ] OZ Smart Account + policy family_recovery/inheritance (timelock enforce cả chi tiêu — collusion chết tại đây); migration ví cũ có rollback
- [ ] Trọn checklist go-live mainnet trong skill (RPC chính+fallback, cron TTL, phí, verify explorer)
- [ ] SCF Build + Soroban Audit Bank; lên store public
- **CỔNG:** 1 ví mainnet thật hoàn tất recovery + 1 inheritance mô phỏng end-to-end; audit booking xác nhận.

---
Tổng lực: ~10–12 tuần một mình với Claude Code; ~6–8 tuần nếu 2 người. Đường găng: G2 → G3 → G5 (mọi thứ khác song song được). Điểm quay đầu duy nhất đã định trước: gate P0-M1 ở G9.
