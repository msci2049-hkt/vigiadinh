# PROJECT-BRIEF — FamilyWallet (tên dev: VíGiaĐình / GIADINH)


> ⚠️ **CẬP NHẬT 2026-07-20 — tính năng KÉT DI CHÚC (will vault) ĐÃ HỦY.**
> Mọi mục nhắc "két di chúc", "di chúc mã hóa", "Shamir", "lời nhắn cuối", "anchor will hash",
> "server không đọc được di chúc" trong file này là **lịch sử**, KHÔNG dựng theo.
> Skill `fw-will-vault` còn trên đĩa nhưng không áp dụng. Thừa kế GIỮ LẠI (chia % + heartbeat
> + heir claim), chỉ bỏ phần két/di chúc mã hóa. Xem `docs/TEMPLATE-DEVIATIONS.md`.

Tài liệu duy nhất cần đọc để hiểu TOÀN BỘ dự án. Cập nhật 20/7/2026.

## 1. Sản phẩm trong 5 câu
Ví crypto hiện nay bắt người dùng giữ 12 từ khóa; mất là mất trắng — ước tính ~20% Bitcoin (~140 tỷ USD theo NYT 2021) đã nằm chết trong ví không mở được. FamilyWallet bỏ seed phrase: chủ ví chọn 3–5 người thân làm **người bảo hộ**; mất máy thì đủ ngưỡng (vd 2/3) bấm đồng ý + qua thời gian chờ (chủ ví veto được) là ví về máy mới. Cùng cơ chế đó chạy **thừa kế**: chủ ví chạm "tôi vẫn khỏe" định kỳ; im lặng đủ lâu → guardian xác nhận → tài sản + **di chúc mã hóa + lời nhắn cuối** chuyển cho người thừa kế — không cần tòa án, chạy giống hệt nhau ở mọi quốc gia. **Người gác đêm** (AI) chấm điểm mọi yêu cầu khôi phục, cảnh báo bất thường, dịch mọi thứ ra tiếng người theo ngôn ngữ từng thành viên — nhưng không giữ khóa, không tự quyết. Hệ **theo dõi kết nối** ping máy guardian 12:00 hằng ngày + xác nhận tay 90 ngày, báo chủ ví ngay khi một người mất máy — vá đúng chỗ mọi ví social recovery chết thầm lặng.

## 2. Vì sao thắng được (định vị)
- vs SEP-30 (Stellar): họ dùng máy chủ khôi phục của công ty; mình dùng người thân — không phụ thuộc công ty nào còn sống.
- vs Argent/Safe (Ethereum): gas đắt làm thao tác guardian tốn kém; Stellar phí ~0,00001 XLM → ping/đổi guardian/health-check thoải mái. Stellar có multisig TRONG LÕI — không bolt-on.
- Thừa kế là mảng thị trường vừa được xác nhận (Kresus Series A ~38M USD 2/2026 với inheritance là tính năng doanh thu; Bitkey của Block đã ship).
- Khoảng trống chưa ai chiếm trên Stellar: guardian chỉ-cần-email kiểu ZK Email (roadmap Phase 4).

## 3. Kiến trúc (một đoạn)
Custody trên Stellar: Phase 1–2 = classic native multisig (guardian là signer, weight 1, master=threshold) + Soroban **Recovery Registry** làm bảng điều phối on-chain (vote/threshold/timelock/veto, KHÔNG giữ tiền); Soroban không phát được classic op nên bước đổi signer (SetOptions) do client build & submit sau khi contract mở cổng. Phase 3 chuyển custody vào **OpenZeppelin Smart Account** + policy tự viết (recovery/inheritance) — khi đó timelock enforce cả chi tiêu, diệt lỗ hổng collusion. Backend Bun+Hono (mirror/notify/presence/risk — KHÔNG custody), AI service tách riêng không quyền ghi, FE Vite một codebase → web + Capacitor Android/iOS. ~~Két di chúc~~ (**ĐÃ HỦY 2026-07-20** — mô tả dưới đây là lịch sử): mã hóa libsodium tại client, khóa K chia Shamir 2-of-3 (lib Privy đã audit Cure53+Zellic) phát cho guardian, chỉ ghép sau event thừa kế on-chain — server mù hoàn toàn.

## 4. Trạng thái thật (đối chiếu SCAN-REPORT 19/7)
ĐÃ CÓ: recovery contract chạy thật trên Testnet — CONTRACT_ID `CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V`, 13+ tx (e2e trọn luồng, timelock chặn thật, veto chặn thật, 1 guardian đơn lẻ bị `tx_bad_auth`); 12/12 unit test (sau fix); wasm 8KB; frontend 7 màn build sạch; mockup 41 màn làm spec.
LỖ HỔNG MỞ (không giấu): (1) **DoS** — request Pending không hết hạn, chỉ owner cancel → initiate rác lúc owner mất key là khóa chết recovery; (2) **phiếu ma** — guardian bị remove vẫn được đếm phiếu cũ; (3) **collusion** — 2 guardian ký chung rút được tiền/chiếm ví vì med/high=2, ngoài tầm contract (trade-off classic multisig: disclose + khuyến nghị 3/5 + Phase 3 diệt hẳn).
NỢ: fix test có thể chưa commit; thiếu LICENSE/.git-history; demo-veto.sh không tự chạy độc lập; QA cũ còn chỗ nói sai "Soroban gọi SetOptions".

## 5. Thuật ngữ nội bộ ↔ chữ cho người dùng
guardian → người bảo hộ · threshold → cần mấy người đồng ý · timelock → thời gian chờ · veto → nút Hủy/Chặn · heartbeat → "tôi vẫn khỏe" · presence ping → kiểm tra kết nối 12:00 · night watch → người gác đêm · heir → người thừa kế. *(will vault → két di chúc: tính năng ĐÃ HỦY.)* CẤM chữ cột trái xuất hiện trong UI/notification.

## 6. Quyết định đã chốt (không mở lại nếu không có lý do mới)
Stack chuẩn MSCI (Bun+Hono+Drizzle / React19+Vite — degit 2 template mẫu, tuân CLAUDE.md của chúng) · mobile = Capacitor với gate P0-M1 (fail passkey/silent-push trong 2 ngày thử → đổi React Native) · Shamir = lib Privy · fee sponsor = OZ Relayer (Launchtube chết) · risk engine = rules thuần, LLM chỉ explainer/copilot · sản phẩm toàn cầu, en mặc định, không Zalo/VND/luật-nước-cụ-thể trong core.

## 7. Roadmap
P0 (nay): vá 3 nợ contract + hồ sơ (LICENSE, git, CONTRACT_ID vào README). P1 (tuần 1–4): backend nền + presence + indexer/notify + web 3 luồng e2e → 10–20 gia đình thử testnet → SCF Kickstart. P2 (5–10): inheritance contract + will vault + AI explainer/copilot + Capacitor (gate P0-M1) → TestFlight/Internal. P3 (11–16): OZ Smart Account (diệt collusion) + mainnet (skill stellar-mainnet-deploy) + SCF Build + Audit Bank + lên store. P4: ZK Email guardian, behavioral layer, anchor nạp/rút theo thị trường.

## 8. Nguồn sự thật
UI: vigiadinh-mockup.html · Kỹ thuật AI: vigiadinh-ai-kien-truc.md · Tổng checklist: familywallet-master-checklist.md · REBUILD-CHECKLIST.md (dựng lại 100%) · Chuẩn nâng tầm: vigiadinh-nang-tam-quoc-te.md · Bằng chứng on-chain: SCAN-REPORT.md + E2E-EVIDENCE.md (agent e2e-verifier sinh).
