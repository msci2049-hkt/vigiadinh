# Luật an toàn — FamilyWallet (bất biến, không thương lượng)

## Bốn nguyên tắc gốc
1. **Custody nằm trên chuỗi.** Backend sập/bị chiếm: không ai mất tiền, không ai mất quyền khôi phục. Mọi thiết kế làm backend thành điểm chết custody = bác bỏ ngay từ review.
2. **AI nhìn — không cầm.** Service AI không secret, không quyền ghi DB/chain, không tool. Kill-switch `AI_ENABLED=false` phải để mọi luồng chạy đủ.
3. **Server không đọc được di chúc.** Chỉ ciphertext + hash rời khỏi máy người dùng. Plaintext xuất hiện trong log/request body = lỗi P0.
4. **Toàn cầu từ ngày 1.** Không seed phrase (passkey), không hardcode ngôn ngữ/kênh chat/tiền tệ của nước nào.

## Khóa & secret
- Cấm seed `S...` trong repo/log/chat. Pre-commit đã quét `S[A-Z0-9]{55}` — không được tắt hook.
- Private key passkey không bao giờ serialize. Key deploy testnet ≠ key mainnet ≠ key dev.
- Secrets qua env/CI vault; `.env` trong `.gitignore`; pino đã che password/token/cookie — thêm trường nhạy cảm mới thì thêm vào redact list.

## LLM (OWASP)
- LLM = hostile user: sau gateway, rate limit, không memory giữa request.
- Cấm chuỗi tự do on-chain (memo, tên tự đặt) vào prompt — placeholder id, render tên từ DB local.
- Output validate: không URL/địa chỉ ví/cụm "cứ duyệt đi"; fail → template tĩnh.

## Quyền & hành vi
- Risk score chỉ trì hoãn + báo động, KHÔNG BAO GIỜ tự cancel (tránh thành DoS mới).
- Trạng thái online guardian chỉ chủ ví thấy. Không lưu vị trí; IP giữ ≤30 ngày.
- Mọi hành động hệ trọng (duyệt, veto, ký) là của CON NGƯỜI, sau biometric.

## On-chain
- Dữ liệu sống còn: persistent/instance — CẤM temporary.
- `SetOptions` production: thêm key mới → verify ký được → mới hạ key cũ; mỗi tx đổi MỘT thứ.
- Threat model 1 trang phải cập nhật khi thêm tính năng chạm custody/khóa/di chúc.
