---
name: fw-will-vault
description: "Két di chúc & lời nhắn cuối của FamilyWallet: mã hóa client-side (libsodium), chia khóa Shamir 2-of-3 cho guardian, anchor SHA-256 lên Stellar, chỉ giải mã được sau khi thừa kế kích hoạt on-chain. Dùng skill này khi đụng đến: di chúc, will vault, lời nhắn cuối, last message, mã hóa client-side, libsodium, sodium, Shamir, secret sharing, anchor hash, XChaCha20, két bảo mật, server không đọc được, zero-knowledge storage."
---

# FamilyWallet — Will Vault

Một câu bất biến chi phối mọi dòng code ở đây: **server không bao giờ đọc được di chúc.** Nếu backend bị chiếm trọn, kẻ tấn công chỉ có được ciphertext.

## THƯ VIỆN — đã chốt, không thay
- Mã hóa: `libsodium-wrappers-sumo` — `crypto_secretstream_xchacha20poly1305` (file lớn: video lời nhắn) hoặc `crypto_secretbox` (blob nhỏ).
- Chia khóa: **`shamir-secret-sharing` (Privy)** — audit độc lập bởi Cure53 và Zellic, zero-dependency, GF(2^8), làm việc trên Uint8Array. KHÔNG dùng lib Shamir khác (đa số không audit).
- Lưu ý từ chính tài liệu lib: nó KHÔNG tự verify kết quả ghép — mình phải tự kiểm (xem Bước 5).

## LUỒNG MÃ HÓA (toàn bộ tại client)
1. Sinh khóa K = `crypto_secretstream_keygen()` (32 byte) — mỗi ví một K, mỗi lần thay di chúc có thể xoay K mới.
2. Mã hóa từng tài liệu: di chúc (text/PDF), lời nhắn cuối (audio/video, mỗi người nhận một blob riêng).
3. `sha256(plaintext)` từng bản → gọi contract `anchor_will_hash(wallet, hash)` → có bằng chứng on-chain "văn bản này tồn tại từ ngày X, chưa ai sửa một byte".
4. `split(K, 3, 2)` bằng shamir-secret-sharing → 3 share.
5. **Tự verify ngay:** `combine([share_i, share_j])` cho MỌI cặp phải ra đúng K (so bằng constant-time compare) rồi mới đi tiếp — lib không làm hộ.
6. Mỗi share mã hóa bằng public key THIẾT BỊ của từng guardian (sealed box `crypto_box_seal`) → upload `shamir_shares` + ciphertext blobs lên server. K bị **xóa khỏi bộ nhớ** (`sodium_memzero`), không lưu ở đâu.

## LUỒNG GIẢI MÃ (chỉ một đường)
Điều kiện mở: event `inheritance_finalized` on-chain (đủ phiếu + hết timelock + owner không veto). Server đối chiếu event thật qua indexer — **không tin request từ client**.
1. Server mở API tải share cho từng guardian liên quan.
2. ≥2 guardian mở app → giải sealed box bằng key thiết bị → gửi share (mã hóa đầu-cuối) cho heir.
3. Heir `combine()` tại máy → K → giải mã di chúc + lời nhắn. So `sha256(plaintext)` với hash đã anchor — khớp mới hiển thị, lệch là báo "bản lưu đã bị sửa".
Owner còn sống luôn tự đọc/sửa được (owner giữ K trong secure storage máy mình — mất máy thì recovery xong tạo K mới, re-encrypt, re-split).

## VÌ SAO KHÔNG DÙNG CÁCH KHÁC
- Passphrase cho heir = tái phát minh seed phrase — đúng cái sản phẩm thề bỏ.
- Server giữ K = một lệnh tòa án / một admin xấu là đọc được di chúc cả hệ thống.
- Share cho chính heir giữ từ đầu = heir đọc trộm trước khi owner mất — Shamir cho GUARDIAN, phát cho heir chỉ sau event on-chain.

## RANH GIỚI PHÁP LÝ (bắt vào UI, không phải chú thích)
Sản phẩm toàn cầu → không tư vấn luật nước nào. Mọi màn soạn di chúc hiển thị cố định: "Văn bản này chưa qua chứng thực pháp lý. Với tài sản ngoài ví, hãy làm thủ tục theo luật nơi bạn sống." Tài sản TRONG ví thì chuyển tự động on-chain — không cần ai cho phép, đó là điểm bán.

## NGHIỆM THU
- [ ] Grep toàn repo: plaintext di chúc không xuất hiện trong bất kỳ request/log nào
- [ ] DB dump chỉ chứa ciphertext + hash
- [ ] Ghép 2/3 mọi cặp share ra đúng K; 1 share không ra gì
- [ ] Sửa 1 byte ciphertext → giải mã fail rõ ràng, không ra rác
- [ ] Hash on-chain khớp plaintext sau round-trip đầy đủ
- [ ] API tải share trả 403 khi CHƯA có event finalize thật
