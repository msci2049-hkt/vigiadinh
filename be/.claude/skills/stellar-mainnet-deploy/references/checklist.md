# Checklist Go-Live Mainnet — tick từng mục trước ngày deploy

## A. Code & test
- [ ] Toàn bộ unit test pass; e2e chạy trọn luồng chính trên Testnet ít nhất 1 lần cuối, bản build y hệt bản sẽ deploy.
- [ ] Không còn hàm test/mock/backdoor (kiểu `test_mint`, `reset`, `dev_only`) trong wasm release.
- [ ] Không hardcode contract ID, RPC, passphrase testnet ở bất kỳ đâu — grep toàn repo: `grep -rn "Test SDF" . && grep -rn "testnet" src/`.
- [ ] Dữ liệu sống còn (balance, danh sách guardian, config, quyền) nằm ở persistent/instance storage, KHÔNG ở temporary.
- [ ] Xử lý lỗi khi entry bị archive (auto-restore làm tx nặng hơn — UI không được treo).
- [ ] Nếu contract nhận tiền: có đường rút/thu hồi rõ ràng, đã test.

## B. Quyền & upgrade
- [ ] Trả lời được: contract này upgradeable hay immutable? Ghi vào README.
- [ ] Nếu upgradeable: hàm upgrade chỉ admin gọi được; admin là ví lạnh/multisig, không phải key dev; đã test upgrade trên testnet.
- [ ] Nếu immutable: cả team xác nhận hiểu rằng bug = deploy contract mới + migrate.
- [ ] Danh sách ai giữ key gì, lưu ở đâu — viết ra giấy/password manager, không nằm trong repo.

## C. Khóa & bảo mật
- [ ] Key deploy tạo MỚI riêng cho mainnet, seed chưa từng xuất hiện trong code/chat/log.
- [ ] `git log -p | grep -iE "S[A-Z0-9]{55}"` không ra seed nào.
- [ ] `.env`, `identity/` nằm trong `.gitignore`.
- [ ] Secrets CI (nếu deploy bằng CI) đặt trong secret store của CI, scope tối thiểu.
- [ ] Đã đọc lướt Security Best Practices: developers.stellar.org/docs/build/security-docs (auth, require_auth đặt đúng chỗ, không tin dữ liệu ngoài).

## D. Hạ tầng
- [ ] Đã chọn RPC mainnet chính + 1 fallback (references/rpc-providers.md); test cả hai bằng `getHealth`.
- [ ] Horizon: nếu app dùng Horizon, xác nhận nguồn cho production (horizon.stellar.org chỉ cho traffic thấp).
- [ ] Env production (`.env.production`) đầy đủ: PASSPHRASE PUBLIC, RPC, HORIZON, CONTRACT_ID (điền sau khi deploy).
- [ ] App chặn ví sai mạng (Freighter đang Testnet) và báo lỗi tiếng người.

## E. Tiền
- [ ] Account deploy đã nhận đủ XLM (khuyến nghị 10–20 XLM) — xác nhận trên stellar.expert.
- [ ] Hiểu base reserve: 1 XLM tối thiểu cho account + 0.5 XLM cho mỗi entry (signer, trustline...).
- [ ] Nếu sponsor phí cho user: đã dựng fee-bump hoặc OpenZeppelin Relayer, có account quỹ phí riêng và ngưỡng cảnh báo cạn quỹ.

## F. Ngày deploy
- [ ] Deploy theo đúng trình tự: upload → deploy → initialize → smoke test 1 giao dịch thật nhỏ → cập nhật CONTRACT_ID vào env → deploy frontend.
- [ ] Ghi lại: CONTRACT_ID, WASM_HASH, tx hash, block time, phí thực tế.
- [ ] Verify trên stellar.expert/explorer/public.
- [ ] Chạy ngay lần extend TTL đầu tiên cho instance + code.

## G. Sau go-live (tuần đầu)
- [ ] Cron extend TTL đã chạy ít nhất 1 lần thành công.
- [ ] Có kênh theo dõi lỗi (log backend, alert tx fail).
- [ ] Runbook sự cố: RPC chết → đổi fallback thế nào; key lộ → xoay key/SetOptions thế nào; contract lỗi → kế hoạch migrate.
- [ ] Số dư quỹ phí được theo dõi.

## Riêng dự án có Classic multisig (ví, social recovery)
- [ ] Kịch bản SetOptions (thêm/bớt signer, đổi threshold) đã diễn tập trên testnet với ĐÚNG weights sẽ dùng thật.
- [ ] Trên mainnet: thêm key mới trước → xác nhận ký được → mới hạ/xóa key cũ. Mỗi tx chỉ đổi một thứ.
- [ ] Kiểm tra bằng tay: tổng weight khả dụng luôn ≥ high threshold sau MỖI bước — không có bước nào tạo ra trạng thái không ai đủ quyền.
- [ ] Tính đủ base reserve cho số signer mới (0.5 XLM/signer).
