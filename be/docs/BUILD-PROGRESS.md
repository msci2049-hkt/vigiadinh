# BUILD-PROGRESS — FamilyWallet (VíGiaĐình)

> Nguồn gốc ở repo **BE** (`stellaer-be/docs/BUILD-PROGRESS.md`); FE + contract mirror khi cần.
> Marathon nhiều session, mỗi session 1 milestone rồi dừng báo cáo. Đường găng: **M0 → M2 → M3 → M6**.
> Lần quét gần nhất: **2026-07-20** (session khởi động — Section 0 + đối chiếu thực tế).

---

## 0 · KẾT QUẢ QUÉT THỰC TẾ (2026-07-20) — không tin tài liệu, chạy thật

| Kiểm tra | Kết quả |
|---|---|
| BE `bun run validate` | ✅ PASS — typecheck · biome (165 file) · boundaries · env-parity (27 key) · contract-hash `7dead0001672…` |
| BE `bun test` | ✅ 88 pass / 3 skip / 0 fail — 91 test / 21 file / 230 expect (27.0s) |
| FE `pnpm validate` | ✅ 11/11 task turbo (typecheck + module-boundaries) |
| Contract `cargo test` (recovery-registry) | ✅ 12 pass / 0 fail (4.4s) |
| FE e2e (Playwright) | ⏸️ CHƯA chạy lại session này (cần build ~6m + preview). Bằng chứng cũ: git log FE `06320e6` = 20/20 chromium. |

### ⚠️ Chỗ LỆCH giữa prompt/tài liệu và thực tế (đã sửa nhận thức)
1. **"22 commit local" — SAI.** Thực tế: BE = **69 commit**, FE = **48 commit** trên nhánh
   `chore/skill-library`. Hai repo degit từ template nên mang cả lịch sử template; phần việc
   FamilyWallet = **31 commit** vượt trên `main` (BE).
2. **Nhánh làm việc = `chore/skill-library`, KHÔNG phải `main`.** `main` (local + `origin/main`)
   vẫn trỏ **lịch sử TEMPLATE**, chưa có việc FamilyWallet. User yêu cầu commit lên `main` của repo mới.
3. **Remote đang trỏ repo TEMPLATE**, chưa phải repo dự án:
   - BE `origin` = `git@github-msci:msci2026vn/code-base-mau-be-chuan-cho-cac-du-an.git`
   - FE `origin` = `git@github-msci:msci2026vn/mau-demo-fe-vite.git`
   - User cấp URL mới: `https://github.com/msci2026vn/vi-gia-dinh.git` (chưa cấu hình — xem T3, CHẶN).
4. **Thư mục contract `vigiadinh-main/` KHÔNG phải git repo** (cả 2 cấp). Lịch sử contract không
   nằm trong "commit local". Sẽ cần `git init` khi chốt chiến lược repo.
5. **`docs/BUILD-PROGRESS.md` trước đó KHÔNG tồn tại** → file này tạo mới session 2026-07-20.
6. **`docs/ONCHAIN-EVENTS.md` trước đó KHÔNG tồn tại** → tạo mới (T4, xem dưới).

### Môi trường / tooling (đã xác nhận có)
bun 1.3.14 · pnpm 11.11 · node 22 · cargo/rustc 1.97 · stellar-cli 27.0.0 · docker 29 · **gh ABSENT**
(push qua SSH alias `github-msci → github.com`, IdentityFile đã cấu hình). git id = `lipxjh1`.

### Docker (yêu cầu "container mới, không trùng, port khác") — ĐÃ THOẢ khi bootstrap
Stack đang chạy: project `familywallet-api` (tên riêng, không trùng), port **random loopback**
`DB_PORT=43339` `REDIS_PORT=44397` mailhog `44271/44555`, không hardcode 5432/6379 → không giẫm
dự án khác. Theo đúng `.claude/rules/docker.md`. Chưa cần dựng thêm; sẽ điều chỉnh nếu user muốn tên/port khác.

---

## 1 · BỐN VIỆC TREO (làm trước mọi milestone)

- [x] **T1 · Key đã lộ** — ĐÃ GHI NHẬN. 5 secret seed trong `vigiadinh-main/.../scripts/keys.json`
  coi như công khai. Lịch sử git BE + FE **sạch (0 match)**; contract chưa có git. Viết
  `docs/SECURITY-NOTES.md` (địa chỉ G... bị cấm mainnet vĩnh viễn + yêu cầu sinh key testnet mới lúc
  M0 deploy + `.gitignore keys.json` trước khi push thư mục contract). **Chưa sinh key mới / chưa xoá
  file** (chỉ có nghĩa lúc deploy) — tự quyết, ghi trong SECURITY-NOTES.
- [ ] **T2 · Mockup thiếu** — CHẶN. `vigiadinh-mockup.html` (41 màn) KHÔNG có trong repo FE. FE hiện
  dựng 39 màn theo mô tả chữ. → Cần user cấp file, đặt `docs/mockup/`. Chi tiết giao diện đánh dấu **TẠM**.
- [ ] **T3 · Remote/push** — CHẶN (cần user chốt chiến lược). 22→thực 69/48 commit đang local trên
  `chore/skill-library`. User cấp 1 URL `vi-gia-dinh` cho (có thể) 3 repo. Cần chốt: monorepo hay tách,
  xử lý nhánh `main` (đang trỏ template), có `git init` contract không. **Chưa set-url, chưa push.**
- [x] **T4 · Đối chiếu contract ↔ BE** — XONG (đợt này). Đọc `recovery-registry/src/lib.rs`, liệt kê
  **7 event thật** (`register`,`g_add`,`g_remove`,`initiate`,`approve`,`cancel`,`finalize` —
  `symbol_short!` ≤9 ký tự) + payload → ghi `docs/ONCHAIN-EVENTS.md`. **Cảnh báo:** M0 sẽ đổi/mở rộng
  event → phải regenerate file này sau khi M0 deploy, TRƯỚC khi build M2.

---

## 2 · MILESTONE

### M0 · CONTRACT (vá lỗ hổng + inheritance) — **CHƯA BẮT ĐẦU**
Hiện trạng: recovery-registry base đã deploy testnet (`CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V`),
12/12 test pass, nhưng CÒN 3 lỗ hổng mở (DoS request treo · phiếu ma · collusion) + CHƯA có contract
`inheritance`. Đây là điểm bắt đầu đường găng.
- Cổng: `soroban-auditor` hết P0 · `e2e-verifier` xuất `E2E-EVIDENCE.md` đủ tx hash. → chưa chạy.

### M1 · BE presence (ping 12:00) — **CHƯA BẮT ĐẦU** (song song, không phụ thuộc contract)
Cron/repeatable job template CHƯA CÓ (`redlock.ts` mồ côi). Schema `presence_pings`/`devices` đã có
nhưng thiếu cột timezone chủ ví.

### M2 · BE indexer + notify — **CHƯA BẮT ĐẦU** (phụ thuộc T4 ✅ + M0)
Phụ thuộc event contract sau M0. `will_hash_anchored` BỎ QUA (đã hủy).

### M3 · BE wallets/guardians/recovery — **CHƯA BẮT ĐẦU** (module khung đã có, chưa logic)
### M4 · BE risk engine — **CHƯA BẮT ĐẦU** (song song)
### M5 · BE inheritance — **CHƯA BẮT ĐẦU** (phụ thuộc M0 inheritance contract)
### M6 · FE passkey + 3 luồng — **CHƯA BẮT ĐẦU** (39 màn khung đã dựng, chi tiết TẠM vì thiếu mockup)
### M7 · FE gác đêm + thừa kế — **CHƯA BẮT ĐẦU**
### M8 · Đóng gói bằng chứng — **CHƯA BẮT ĐẦU**

---

## 3 · NHẬT KÝ SESSION

### Session 2026-07-20 (khởi động) — Section 0 + T1/T4 + tạo tiến độ
- **Đã làm:** quét thực tế 3 repo (git/test/tooling/docker), đối chiếu & sửa 6 chỗ lệch vs prompt;
  T4 XONG (`docs/ONCHAIN-EVENTS.md` — 7 event thật); T1 GHI NHẬN (`docs/SECURITY-NOTES.md`); tạo file này.
- **Cổng:** N/A (session scan). Baseline test: BE validate ✅ · BE 88 pass ✅ · FE validate 11/11 ✅ · contract 12 pass ✅.
- **Còn lại:** T2 (mockup) + T3 (repo/push) CHẶN — cần user. Sau đó M0.
- **Tự quyết:** (1) không sinh key testnet mới ngay (chỉ có nghĩa lúc deploy M0); (2) commit tài liệu
  session này vào nhánh `chore/skill-library` (nơi việc FW đang nằm) — CHƯA push, chờ chốt T3.
- **Chặn bởi:** user cần trả lời (a) chiến lược repo cho `vi-gia-dinh` (monorepo hay tách; xử lý nhánh
  `main` đang trỏ template; có đưa contract vào git không) + xác nhận repo đã tồn tại;
  (b) có file `vigiadinh-mockup.html` không.
